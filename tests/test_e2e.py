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
    assert data["config"]["cc_threshold"] == 10  # echo of effective config

def test_codegen_flag_runs_first(tmp_path):
    # Codegen runs in the working tree BEFORE blob reads; the runner
    # walks committed history, so this test asserts the ordering
    # contract directly: with run_codegen the command executes (file
    # appears on disk), without it the command never runs.
    import os
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _commit(repo, "initial", {"a.py": "x = 1\n"})
    marker = repo / "codegen_ran.txt"
    cfg = dict(CFG, codegen="echo GEN > codegen_ran.txt")
    run(str(repo), cfg)
    assert not marker.exists()
    run(str(repo), cfg, run_codegen=True)
    assert marker.exists() and marker.read_text().strip() == "GEN"

def test_empty_commit_no_crash(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "-c", "user.name=t", "-c", "user.email=t@e.com",
         "commit", "--allow-empty", "-m", "empty root")
    data = run(str(repo), CFG)
    assert len(data["commits"]) == 1
    assert data["commits"][0]["commit"]["verbosity"] == 0.0
    assert data["commits"][0]["commit"]["erosion"] == 0.0

def test_shell_pipeline(tmp_path):
    # .sh must map to the shell heuristic, not "other"
    from historian import git as gitmod
    assert gitmod.lang_of("run.sh") == "sh"
    from historian.langutil import analyze_functions
    funcs = analyze_functions("run.sh", "if [ -n \"$1\" ]; then\n  echo hi\nfi\n", "sh")
    assert funcs and funcs[0].cc >= 2
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _commit(repo, "shell", {"run.sh": "source lib.sh\necho hi\n",
                            "lib.sh": "source run.sh\n"})
    data = run(str(repo), CFG)
    assert "run.sh" in data["commits"][-1]["files"]
    assert data["commits"][-1]["repo"]["import_cycles"]["cycle_count"] >= 1
