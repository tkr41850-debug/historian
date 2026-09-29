"""Plugin discovery + per-commit analysis."""
from __future__ import annotations
import importlib
import subprocess
from pathlib import Path

from . import formulas, git as gitmod
from .plugins.base import MetricPlugin

PLUGIN_DIR = Path(__file__).parent / "plugins"

def discover_plugins(enabled: dict | None = None):
    plugins = []
    for mod in sorted(PLUGIN_DIR.glob("*.py")):
        if mod.stem in ("__init__", "base"):
            continue
        m = importlib.import_module(f"historian.plugins.{mod.stem}")
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

def run(repo, config, max_commits=None, run_codegen=False):
    if run_codegen and config.get("codegen"):
        subprocess.run(config["codegen"], shell=True, cwd=repo, check=True)
    plugins = discover_plugins(config.get("plugins"))
    cc_thr = config.get("cc_threshold", 10)
    gh = (config.get("github_url") or "").rstrip("/")
    try:
        commits = gitmod.list_commits(repo, max_commits)
    except subprocess.CalledProcessError:
        raise SystemExit(f"not a git repo (or no commits): {repo}")
    out, v_hist, e_hist = [], [], []
    for i, c in enumerate(commits):
        files, funcs, ast_l, clone_l, repo_m = analyze_commit(
            repo, c["sha"], plugins, config.get("include", []), config.get("exclude", []))
        loc = sum(fm.get("loc", {}).get("loc", 0) for fm in files.values())
        v = formulas.verbosity(ast_l, clone_l, loc)
        e = formulas.erosion(funcs, cc_thr)
        cc_vals = [f.cc for f in funcs]
        v_hist.append(v); e_hist.append(e)
        out.append({**c, "permalink": f"{gh}/commit/{c['sha']}" if gh else None,
                    "files": files, "repo": repo_m,
                    "commit": {"loc": loc, "verbosity": v, "erosion": e,
                               "functions": len(funcs),
                               "cc_avg": sum(cc_vals)/len(cc_vals) if cc_vals else 0.0}})
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
                       "exclude": config.get("exclude", [])},
            "commits": out}
