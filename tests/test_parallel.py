"""Parallel per-commit analysis: determinism, ordering, jobs=1, isolation."""
import json
import subprocess
from pathlib import Path

from historian.runner import _resolve_jobs, run

CFG = {"codegen": None, "github_url": None, "cc_threshold": 10,
       "plugins": {}, "include": [], "exclude": []}


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


def _repo(tmp_path, n=6):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    for i in range(n):
        body = f"def f{i}(x):\n" + "".join(
            f"    if x == {k}:\n        x += {k}\n" for k in range(i)) \
            + "    return x\n"
        _commit(repo, f"c{i}", {f"m{i}.py": body, "shared.py": f"X = {i}\n"})
    return str(repo)


def _canon(data):
    # JSON round-trip normalizes sets/tuples so serial vs parallel compare equal
    return json.loads(json.dumps(data, default=str))


def test_resolve_jobs():
    assert _resolve_jobs(None, None, 4) >= 1
    assert _resolve_jobs(1, 8, 4) == 1
    assert _resolve_jobs(8, 1, 4) == 4  # CLI wins over config, capped at n
    assert _resolve_jobs(None, 3, 10) == 3
    assert _resolve_jobs(4, None, 2) == 2  # capped at n_commits
    assert _resolve_jobs(4, None, 1) == 1
    assert _resolve_jobs(0, None, 4) == 1
    assert _resolve_jobs(None, None, 0) == 1


def test_jobs_one_equals_serial(tmp_path):
    repo = _repo(tmp_path)
    serial = _canon(run(repo, dict(CFG), progress=False, jobs=1))
    one = _canon(run(repo, dict(CFG, jobs=1), progress=False))
    assert serial == one
    assert serial["config"]["jobs"] == 1


def test_parallel_determinism_and_order(tmp_path):
    repo = _repo(tmp_path)
    serial = _canon(run(repo, dict(CFG), progress=False, jobs=1))
    for jobs in (2, 4):
        par = _canon(run(repo, dict(CFG), progress=False, jobs=jobs))
        assert [c["sha"] for c in par["commits"]] == \
               [c["sha"] for c in serial["commits"]]  # chronological order kept
        serial_commits = [{k: v for k, v in c.items()} for c in serial["commits"]]
        par_commits = [{k: v for k, v in c.items()} for c in par["commits"]]
        assert par_commits == serial_commits
        assert par["meta"] == serial["meta"]
    assert serial["config"]["jobs"] == 1


def test_worker_failure_isolation(tmp_path, monkeypatch):
    from historian import runner as rmod
    repo = _repo(tmp_path, n=4)
    real = rmod.analyze_commit

    def flaky(repo_, sha, plugins, include=(), exclude=()):
        from historian import git as gitmod
        commits = gitmod.list_commits(repo_)
        if sha == commits[1]["sha"]:
            raise RuntimeError("boom")
        return real(repo_, sha, plugins, include, exclude)

    monkeypatch.setattr(rmod, "analyze_commit", flaky)
    data = run(repo, dict(CFG), progress=False, jobs=4)
    assert len(data["commits"]) == 4
    bad = data["commits"][1]
    assert bad["error"].startswith("RuntimeError: boom")
    assert bad["commit"]["verbosity"] == 0.0
    good = [c for i, c in enumerate(data["commits"]) if i != 1]
    assert all("error" not in c for c in good)
    assert [c["sha"] for c in data["commits"]] == \
           [c["sha"] for c in run(repo, dict(CFG), progress=False,
                                  jobs=1)["commits"]]


def test_parallel_empty_repo_single_commit(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init")
    _git(repo, "-c", "user.name=t", "-c", "user.email=t@e.com",
         "commit", "--allow-empty", "-m", "empty root")
    data = run(str(repo), dict(CFG), progress=False, jobs=8)
    assert len(data["commits"]) == 1
    assert data["config"]["jobs"] == 1  # single commit -> serial path
