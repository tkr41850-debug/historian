"""Shared multi-language analysis via lizard (C++/Python/JS/TS/...).

lizard handles C++, Python, JavaScript, TypeScript and more with one API.
Shell (and unknown langs) fall back to a documented line heuristic.
"""
from __future__ import annotations

import re

try:
    import lizard
    _HAS_LIZARD = True
except ImportError:
    _HAS_LIZARD = False

# Extensions lizard reliably parses for our target set
LIZARD_LANGS = {"py", "js", "ts", "other-code"}
SHELL_LANGS = {"sh", "shell", "bash"}

_EXT = {
    "py": ".py", "js": ".js", "ts": ".ts", "other-code": ".cpp",
    "sh": ".sh", "shell": ".sh", "bash": ".sh",
}


def analyze_functions(path: str, source: str, lang: str):
    """Return list of FunctionStat for the file.

    Uses lizard when available and lang is supported; shell/unknown
    falls back to a whole-file pseudo-function with keyword-count CC.
    """
    from .plugins.base import FunctionStat

    lines = source.splitlines()
    if _HAS_LIZARD and lang in LIZARD_LANGS:
        try:
            info = lizard.analyze_file.analyze_source_code(
                path or f"file{_EXT.get(lang, '.cpp')}", source)
            out = []
            for f in info.function_list:
                sloc = max(int(getattr(f, "nloc", 0) or 0), 1)
                out.append(FunctionStat(
                    name=f.name, cc=int(f.cyclomatic_complexity),
                    sloc=sloc, start_line=int(f.start_line),
                    end_line=int(f.end_line)))
            return out
        except Exception:
            pass
    # Fallback: shell keyword heuristic or whole-file pseudo-function
    if lang in SHELL_LANGS:
        cc = 1 + len(re.findall(
            r"\b(if|for|while|until|case|elif)\b|&&|\|\|", source))
        code = [l for l in lines if l.strip() and not l.strip().startswith("#")]
        return [FunctionStat(name="(script)", cc=cc,
                             sloc=max(len(code), 1),
                             start_line=1, end_line=max(len(lines), 1))]
    code = [l for l in lines if l.strip()]
    return [FunctionStat(name="(file)", cc=1, sloc=max(len(code), 1),
                         start_line=1, end_line=max(len(lines), 1))]


def count_loc(source: str):
    """Return (loc, sloc, blank, comment) with a generic classifier."""
    loc, blank, comment = 0, 0, 0
    for line in source.splitlines():
        loc += 1
        s = line.strip()
        if not s:
            blank += 1
        elif s.startswith(("#", "//", "*", "<!--", "%", "--")) or \
                s.startswith("/*") or s.endswith("*/"):
            comment += 1
    sloc = loc - blank - comment
    return loc, max(sloc, 0), blank, comment
