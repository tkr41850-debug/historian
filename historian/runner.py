"""Plugin discovery + per-commit analysis."""
from __future__ import annotations
import importlib
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from . import formulas, git as gitmod
from .plugins.base import MetricPlugin

PLUGIN_DIR = Path(__file__).parent / "plugins"

def discover_plugins(enabled: dict | None = None):
    plugins = []
    for mod in sorted(PLUGIN_DIR.glob("*.py")):
        if mod.stem in ("__init__", "base"):
            continue
        try:
            m = importlib.import_module(f"historian.plugins.{mod.stem}")
        except ImportError as e:
            # A broken/dependency-missing plugin degrades to "ignored"
            # instead of aborting all of analyze.
            print(f"warning: skipping plugin {mod.stem}: {e}", file=sys.stderr)
            continue
        for obj in vars(m).values():
            if isinstance(obj, type) and issubclass(obj, MetricPlugin) and obj is not MetricPlugin:
                inst = obj()
                if enabled is not None and inst.name in enabled and not enabled[inst.name]:
                    continue
                plugins.append(inst)
    return plugins

def _wanted(path, include, exclude):
    if exclude and any(s in path for s in exclude):
        return False
    if include and not any(s in path for s in include):
        return False
    return True

def analyze_commit(repo, sha, plugins, include=(), exclude=()):
    files_out, all_funcs, ast_lines, clone_lines, repo_files = {}, [], set(), set(), {}
    repo_metrics = {}
    for path in gitmod.list_files(repo, sha):
        if not _wanted(path, include, exclude):
            continue
        src = gitmod.read_blob(repo, sha, path)
        # skip binary blobs (images, fonts, archives): surrogateescape
        # round-trips undecodable bytes, so lone surrogates mark binary
        if src is None or "\x00" in src or "\udc80" <= min(src, default="\x00") <= "\udcff":
            continue
        lang = gitmod.lang_of(path)
        repo_files[path] = src
        fmetrics = {}
        for p in plugins:
            try:
                r = p.analyze_file(path, src, lang)
            except Exception:
                continue
            fmetrics[p.name] = r.file_metrics
            all_funcs.extend(r.functions)
            if r.slop_kind == "ast":
                ast_lines |= {f"{path}:{n}" for n in r.slop_lines}
            elif r.slop_kind == "clone":
                clone_lines |= {f"{path}:{n}" for n in r.slop_lines}
        files_out[path] = fmetrics
    for p in plugins:
        try:
            repo_metrics[p.name] = p.analyze_repo(repo_files)
        except Exception:
            repo_metrics[p.name] = {}
    return files_out, all_funcs, ast_lines, clone_lines, repo_metrics

def _resolve_jobs(cli_jobs, cfg_jobs, n_commits):
    """Worker count: CLI wins over config; default is cpu count. Always >= 1."""
    j = cli_jobs if cli_jobs is not None else cfg_jobs
    if j is None:
        j = os.cpu_count() or 1
    try:
        j = int(j)
    except (TypeError, ValueError):
        j = 1
    if j <= 1 or n_commits <= 1:
        return 1
    return min(j, n_commits)


def _analyze_one(repo, commit, plugins, include, exclude, gh, cc_thr):
    """Analyze a single commit; returns (entry, verbosity, erosion).

    Raises on failure — callers record the exception into the entry
    so one bad commit never kills the run.
    """
    files, funcs, ast_l, clone_l, repo_m = analyze_commit(
        repo, commit["sha"], plugins, include, exclude)
    loc = sum(fm.get("loc", {}).get("loc", 0) for fm in files.values())
    v = formulas.verbosity(ast_l, clone_l, loc)
    e = formulas.erosion(funcs, cc_thr)
    cc_vals = [f.cc for f in funcs]
    entry = {**commit,
             "permalink": f"{gh}/commit/{commit['sha']}" if gh else None,
             "files": files, "repo": repo_m,
             "commit": {"loc": loc, "verbosity": v, "erosion": e,
                        "functions": len(funcs),
                        "cc_avg": sum(cc_vals) / len(cc_vals) if cc_vals else 0.0}}
    return entry, v, e


def _error_entry(commit, gh, exc):
    return ({**commit,
             "permalink": f"{gh}/commit/{commit['sha']}" if gh else None,
             "files": {}, "repo": {},
             "commit": {"loc": 0, "verbosity": 0.0, "erosion": 0.0,
                        "functions": 0, "cc_avg": 0.0},
             "error": f"{type(exc).__name__}: {exc}"}, 0.0, 0.0)
def run(repo, config, max_commits=None, run_codegen=False, progress=True,
        jobs=None):
    if run_codegen and config.get("codegen"):
        subprocess.run(config["codegen"], shell=True, cwd=repo, check=True)
    plugins = discover_plugins(config.get("plugins"))
    cc_thr = config.get("cc_threshold", 10)
    gh = (config.get("github_url") or "").rstrip("/")
    try:
        commits = gitmod.list_commits(repo, max_commits)
    except subprocess.CalledProcessError:
        raise SystemExit(f"not a git repo (or no commits): {repo}")
    n = len(commits)
    n_jobs = _resolve_jobs(jobs, config.get("jobs"), n)
    include, exclude = config.get("include", []), config.get("exclude", [])
    # results[i] keeps chronological order regardless of completion order
    results: list = [None] * n
    if n_jobs <= 1:
        iterator = enumerate(commits)
        if progress:
            try:
                from tqdm import tqdm
                iterator = enumerate(tqdm(commits, desc="analyzing commits",
                                          unit="commit", dynamic_ncols=True))
            except ImportError:
                pass
        for i, c in iterator:
            try:
                results[i] = _analyze_one(repo, c, plugins, include, exclude,
                                          gh, cc_thr)
            except Exception as exc:  # per-commit failure is recorded, not fatal
                results[i] = _error_entry(c, gh, exc)
    else:
        try:
            from tqdm import tqdm
            bar = tqdm(total=n, desc=f"analyzing commits (jobs={n_jobs})",
                       unit="commit", dynamic_ncols=True) if progress else None
        except ImportError:
            bar = None
        with ThreadPoolExecutor(max_workers=n_jobs,
                                thread_name_prefix="historian") as ex:
            futs = {ex.submit(_analyze_one, repo, c, plugins, include,
                              exclude, gh, cc_thr): i
                    for i, c in enumerate(commits)}
            try:
                for fut in as_completed(futs):
                    i = futs[fut]
                    try:
                        results[i] = fut.result()
                    except Exception as exc:
                        results[i] = _error_entry(commits[i], gh, exc)
                    if bar is not None:
                        bar.update(1)
            finally:
                if bar is not None:
                    bar.close()
    out, v_hist, e_hist = [], [], []
    for entry, v, e in results:
        v_hist.append(v); e_hist.append(e)
        out.append(entry)
    bv, _ = formulas.linear_fit(list(range(len(v_hist))), v_hist)
    be, _ = formulas.linear_fit(list(range(len(e_hist))), e_hist)
    return {"meta": {"tool": "historian", "cc_threshold": cc_thr,
                     "trajectory": {"delta_v": (v_hist[-1]-v_hist[0]) if v_hist else 0.0,
                                    "delta_e": (e_hist[-1]-e_hist[0]) if e_hist else 0.0,
                                    "beta_v": bv, "beta_e": be}},
            "config": {"cc_threshold": cc_thr, "codegen": config.get("codegen"),
                       "github_url": config.get("github_url"),
                       "plugins": config.get("plugins"),
                       "include": config.get("include", []),
                       "exclude": config.get("exclude", []),
                       "jobs": n_jobs},
            "commits": out}
