"""CLI: python -m historian --repo <path> [--out FILE] [--outdir DIR] [--codegen]"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

def load_config(path):
    if not path:
        return {}
    p = Path(path)
    if not p.is_file():
        print(f"config not found: {path}", file=sys.stderr)
        sys.exit(2)
    try:
        import yaml
    except ImportError:
        print("pyyaml needed for config files: pip install pyyaml", file=sys.stderr)
        sys.exit(2)
    try:
        return yaml.safe_load(p.read_text()) or {}
    except Exception as e:
        print(f"invalid config {path}: {e}", file=sys.stderr)
        sys.exit(2)

def resolve_out(repo, out=None, outdir=None):
    """Final output path: explicit --out wins; otherwise
    {outdir}/history-{repo}.json (outdir defaults to cwd, created if missing)."""
    if out:
        return Path(out)
    d = Path(outdir) if outdir else Path(".")
    d.mkdir(parents=True, exist_ok=True)
    name = Path(repo).resolve().name
    if name.endswith(".git"):
        name = name[:-4]
    if not name:
        name = Path.cwd().name
    return d / f"history-{name}.json"

def main(argv=None):
    from .runner import run
    ap = argparse.ArgumentParser(prog="historian")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", default=None,
                    help="output JSON path (wins over --outdir)")
    ap.add_argument("--outdir", default=None,
                    help="output directory, written as {outdir}/history-{repo}.json "
                         "(default: current directory)")
    ap.add_argument("--config", default=None)
    ap.add_argument("--max-commits", "--commits", dest="max_commits", type=int, default=None)
    ap.add_argument("--codegen", action="store_true", help="run config codegen cmd first")
    ap.add_argument("--no-codegen", dest="codegen", action="store_false",
                    help="do not run codegen even if configured")
    ap.add_argument("--include", nargs="*", default=None, help="only analyze paths containing these")
    ap.add_argument("--exclude", nargs="*", default=None, help="skip paths containing these")
    ap.add_argument("--plugin", dest="plugins", action="append", default=[],
                    metavar="name[=on|off]",
                    help="override plugin enable (repeatable), e.g. --plugin verbosity=off")
    ap.add_argument("--no-progress", dest="progress", action="store_false",
                    help="hide the tqdm commit progress bar")
    ap.add_argument("--jobs", "-j", type=int, default=None,
                    help="parallel workers for per-commit analysis "
                         "(default: cpu count; 1 = serial)")
    a = ap.parse_args(argv)
    out_path = resolve_out(a.repo, a.out, a.outdir).resolve()
    print(f"will write to: {out_path}")
    if out_path.exists():
        print(f"warning: {out_path} already exists and will be overwritten",
              file=sys.stderr)
    cfg = load_config(a.config)
    if a.include is not None:
        cfg["include"] = a.include
    if a.exclude is not None:
        cfg["exclude"] = a.exclude
    for spec in a.plugins:
        name, _, val = spec.partition("=")
        enabled = cfg.setdefault("plugins", {})
        enabled[name] = val.lower() not in ("0", "off", "false", "no")
    import json as _json
    eff = {"codegen": cfg.get("codegen"), "github_url": cfg.get("github_url"),
           "cc_threshold": cfg.get("cc_threshold", 10), "plugins": cfg.get("plugins"),
           "include": cfg.get("include", []), "exclude": cfg.get("exclude", []),
           "jobs": a.jobs if a.jobs is not None else cfg.get("jobs")}
    print(f"config: {_json.dumps(eff, default=str)}")
    data = run(a.repo, cfg, a.max_commits, a.codegen, progress=a.progress,
               jobs=a.jobs)
    out_path.write_text(json.dumps(data, indent=2, default=str))
    print(f"wrote {len(data['commits'])} commits -> {out_path}")

if __name__ == "__main__":
    main()
