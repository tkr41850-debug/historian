"""Git history access without checkouts (git show SHA:path)."""
from __future__ import annotations
import subprocess

SEP = "\x1f"
LOG_FMT = f"%H{SEP}%an{SEP}%ae{SEP}%at{SEP}%s{SEP}%b%x1e"

def _git(repo, *args):
    return subprocess.run(["git", "-C", repo, *args], capture_output=True, text=True,
                          errors="surrogateescape", check=True).stdout

def list_commits(repo, max_commits=None):
    out = _git(repo, "log", f"--format={LOG_FMT}", "--no-merges")
    commits = []
    RS = chr(30)
    for chunk in out.split(RS):
        if not chunk.strip():
            continue
        # strip newlines only: str.strip() eats \x1f field separators
        parts = chunk.strip("\n").split(SEP)
        if len(parts) < 5:
            continue
        sha, an, ae, at, subj = (p.strip() for p in parts[:5])
        body = parts[5].strip() if len(parts) > 5 else ""
        commits.append({"sha": sha.strip(), "author": an, "email": ae,
                        "time": int(at), "subject": subj.strip(), "body": body.strip()})
    commits.reverse()  # oldest first
    if max_commits:
        commits = commits[-max_commits:]
    return commits

def list_files(repo, sha):
    out = _git(repo, "ls-tree", "-r", "--name-only", sha)
    return [l for l in out.splitlines() if l.strip()]

def read_blob(repo, sha, path):
    try:
        return _git(repo, "show", f"{sha}:{path}")
    except subprocess.CalledProcessError:
        return None

def lang_of(path):
    p = path.lower()
    if p.endswith(".py"): return "py"
    if p.endswith((".js", ".jsx", ".mjs", ".cjs")): return "js"
    if p.endswith((".ts", ".tsx")): return "ts"
    if p.endswith((".sh", ".bash")): return "sh"
    if p.endswith((".java", ".go", ".rs", ".c", ".cpp", ".h", ".hpp")): return "other-code"
    return "other"
