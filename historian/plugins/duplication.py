"""Exact structural-duplicate detection → L_clone (verbosity clone half).

Normalizes each line (strip comments/whitespace, lowercase), hashes
sliding windows of >=6 lines; lines in any repeated block are clones.
Cross-file: same normalized block in 2+ files flags both. Within-file
repeats also flag. Pure stdlib.
"""
from __future__ import annotations
import hashlib
import re
from collections import defaultdict
from .base import FileResult, MetricPlugin

WINDOW = 6


def _norm(line: str) -> str:
    s = re.sub(r"(#|//|--).*", "", line).strip().lower()
    return re.sub(r"\s+", " ", s)


class DuplicationPlugin(MetricPlugin):
    name = "duplication"

    def describe(self):
        return f"normalized exact clones window>={WINDOW} -> L_clone"

    def analyze_file(self, path, source, lang):
        lines = source.splitlines()
        norm = [_norm(l) for l in lines]
        # within-file repeats
        seen, dups = {}, set()
        for i in range(len(norm) - WINDOW + 1):
            block = tuple(norm[i:i + WINDOW])
            if not any(block):
                continue
            h = hashlib.md5("|".join(block).encode()).hexdigest()
            if h in seen:
                dups.update(range(seen[h] + 1, seen[h] + WINDOW + 1))
                dups.update(range(i + 1, i + WINDOW + 1))
            else:
                seen[h] = i
        return FileResult(file_metrics={"clone_lines": len(dups)},
                          slop_lines=set(dups), slop_kind="clone")

    def analyze_repo(self, files: dict) -> dict:
        # cross-file: same block hash in 2+ files -> union lines
        owners = defaultdict(set)  # hash -> {(path, idx)}
        for path, src in files.items():
            norm = [_norm(l) for l in src.splitlines()]
            for i in range(len(norm) - WINDOW + 1):
                block = tuple(norm[i:i + WINDOW])
                if not any(block):
                    continue
                owners[hashlib.md5("|".join(block).encode()).hexdigest()].add((path, i))
        per_file = defaultdict(set)
        for paths in owners.values():
            if len({p for p, _ in paths}) < 2:
                continue
            for p, i in paths:
                per_file[p].update(range(i + 1, i + WINDOW + 1))
        return {"clone_lines_by_file": {k: sorted(v) for k, v in per_file.items()}}
