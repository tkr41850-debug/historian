"""CLI: python -m historian --repo <path> --out historian.json [--codegen]"""
from __future__ import annotations
import argparse, json, sys
from pathlib import Path

def load_config(path):
    if not path:
        return {}
    try:
        import yaml
    except ImportError:
        print("pyyaml needed for config files: pip install pyyaml", file=sys.stderr)
        sys.exit(2)
    return yaml.safe_load(Path(path).read_text()) or {}

def main(argv=None):
    from .runner import run
    ap = argparse.ArgumentParser(prog="historian")
    ap.add_argument("--repo", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--config", default=None)
    ap.add_argument("--max-commits", type=int, default=None)
    ap.add_argument("--codegen", action="store_true", help="run config codegen cmd first")
    a = ap.parse_args(argv)
    cfg = load_config(a.config)
    data = run(a.repo, cfg, a.max_commits, a.codegen)
    Path(a.out).write_text(json.dumps(data, indent=2, default=str))
    print(f"wrote {len(data['commits'])} commits -> {a.out}")

if __name__ == "__main__":
    main()
