"""CLI: python -m historian --repo <path> --out historian.json [--codegen]"""
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

def main(argv=None):
    from .runner import run
    ap = argparse.ArgumentParser(prog="historian")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
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
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    if a.include is not None:
        cfg["include"] = a.include
    if a.exclude is not None:
        cfg["exclude"] = a.exclude
    for spec in a.plugins:
        name, _, val = spec.partition("=")
        enabled = cfg.setdefault("plugins", {})
        enabled[name] = val.lower() not in ("0", "off", "false", "no")
    data = run(a.repo, cfg, a.max_commits, a.codegen)
    Path(a.out).write_text(json.dumps(data, indent=2, default=str))
    print(f"wrote {len(data['commits'])} commits -> {a.out}")

if __name__ == "__main__":
    main()
