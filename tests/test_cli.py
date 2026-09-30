"""CLI output-path tests: --out wins, --outdir derives history-{repo}.json."""
import json
import subprocess

from historian.__main__ import main, resolve_out


def _tiny_repo(path):
    path.mkdir()
    subprocess.run(["git", "init"], cwd=path, check=True, capture_output=True)
    (path / "a.py").write_text("x = 1\n")
    subprocess.run(["git", "add", "-A"], cwd=path, check=True, capture_output=True)
    subprocess.run(["git", "-c", "user.name=t", "-c", "user.email=t@e.com",
                    "commit", "-m", "init"], cwd=path, check=True,
                   capture_output=True)
    return path


def test_explicit_out_wins_over_outdir(tmp_path):
    d = tmp_path / "h"
    got = resolve_out(str(tmp_path / "repo"), out=str(tmp_path / "custom.json"),
                      outdir=str(d))
    assert got.name == "custom.json"
    assert not d.exists()  # outdir untouched when --out wins


def test_outdir_derives_name_and_mkdirs(tmp_path):
    d = tmp_path / "deep" / "hist"
    got = resolve_out(str(tmp_path / "myrepo.git"), outdir=str(d))
    assert got == d / "history-myrepo.json"
    assert d.is_dir()


def test_neither_flag_defaults_to_cwd_history_name(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / "repo").mkdir()
    assert resolve_out(str(tmp_path / "repo")).resolve() == tmp_path / "history-repo.json"


def test_main_outdir_writes_and_warns_on_overwrite(tmp_path, capsys):
    repo = _tiny_repo(tmp_path / "repo")
    outdir = tmp_path / "h"
    main(["--repo", str(repo), "--outdir", str(outdir), "--no-progress"])
    out, err = capsys.readouterr()
    target = outdir / "history-repo.json"
    assert target.is_file()
    assert "will write to" in out and str(target) in out
    assert "already exists" not in err
    main(["--repo", str(repo), "--outdir", str(outdir), "--no-progress"])
    _, err2 = capsys.readouterr()
    assert "already exists" in err2
    assert json.loads(target.read_text())["commits"]
