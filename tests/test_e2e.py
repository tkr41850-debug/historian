"""Integration: fixture git repo -> full run -> assertions on trajectory."""
import json
import subprocess
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
    _git(cwd, "-c", "user.name=t", "-c", "user.email=t@e.com",
         "commit", "-m", msg)

def test_end_to_end(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _commit(repo, "initial", {"a.py": "def f(x):\n    return x + 1\n"})
    branchy = "def f(x):\n" + "".join(
        f"    if x == {i}:\n        x += 1\n" for i in range(12)) + "    return x\n"
    _commit(repo, "complexify", {"a.py": branchy,
                                 "b.py": "import a\nprint('debug')\n" * 4})
    _commit(repo, "clone it", {"a.py": branchy,
                               "b.py": "import a\nprint('debug')\n" * 4,
                               "c.py": "import b\n" + "x = 1\n" * 8})
    data = run(str(repo), CFG)
    assert len(data["commits"]) == 3
    assert all(c["permalink"].startswith("https://github.com/org/repo/commit/")
               for c in data["commits"])
    first, last = data["commits"][0], data["commits"][-1]
    assert last["commit"]["erosion"] >= first["commit"]["erosion"]
    assert "beta_v" in data["meta"]["trajectory"]
