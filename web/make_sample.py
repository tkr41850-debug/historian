"""Generate web/sample.json from a real historian run over a fixture repo.

Mirrors tests/test_e2e.py so the sample always matches the runner's schema.
Usage: uv run python web/make_sample.py
"""
import json
import subprocess
import tempfile
from pathlib import Path

from historian.runner import run

CFG = {"codegen": None, "github_url": "https://github.com/org/repo",
       "cc_threshold": 10, "plugins": {}, "include": [], "exclude": []}


def _git(cwd, *args):
    subprocess.run(["git", *args], cwd=cwd, check=True, capture_output=True)


def _commit(cwd, msg, files):
    for name, content in files.items():
        p = Path(cwd) / name
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content)
    _git(cwd, "add", "-A")
    _git(cwd, "-c", "user.name=t", "-c", "user.email=t@e.com", "commit", "-m", msg)


def main():
    with tempfile.TemporaryDirectory() as tmp:
        repo = Path(tmp) / "repo"
        repo.mkdir()
        _git(repo, "init")
        _commit(repo, "initial", {"a.py": "def f(x):\n    return x + 1\n"})
        branchy = ("def f(x):\n" + "".join(
            f"    if x == {i}:\n        x += 1\n" for i in range(12)) + "    return x\n")
        _commit(repo, "complexify", {"a.py": branchy,
                                     "b.py": "import a\nprint('debug')\n" * 4})
        _commit(repo, "clone it", {"a.py": branchy,
                                   "b.py": "import a\nprint('debug')\n" * 4,
                                   "c.py": "import b\n" + "x = 1\n" * 8})
        data = run(str(repo), CFG)
    out = Path(__file__).parent / "sample.json"
    out.write_text(json.dumps(data, indent=2, default=str))
    print(f"wrote {len(data['commits'])} commits -> {out}")


if __name__ == "__main__":
    main()
