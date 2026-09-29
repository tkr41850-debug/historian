"""Static import graph + cycle detection (py/js/ts/c++/sh).

Parses per-language import/include/source statements with regexes,
builds a module graph, reports elementary cycles (Johnson-lite DFS)
and per-file in-cycle flags. stdlib only.
"""
from __future__ import annotations
import os
import re
from .base import FileResult, MetricPlugin

_PATTERNS = {
    "py": [r"^\s*(?:from|import)\s+([\w.]+)"],
    "js": [r"""import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]""",
            r"""require\(\s*['"]([^'"]+)['"]\s*\)"""],
    "ts": [r"""import\s+(?:.*?\s+from\s+)?['"]([^'"]+)['"]""",
            r"""require\(\s*['"]([^'"]+)['"]\s*\)"""],
    "other-code": [r'^\s*#\s*include\s+"([^"]+)"'],
    "sh": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
    "shell": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
    "bash": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
}


def _resolve(base_path, raw, lang):
    raw = raw.strip().strip("'\"")
    if lang == "py":
        return raw.split(".")[0] + ".py"
    p = raw.split("?")[0]
    if p.startswith("."):
        d = os.path.dirname(base_path)
        cands = [os.path.normpath(os.path.join(d, p)),
                 os.path.normpath(os.path.join(d, p + ".py")),
                 os.path.normpath(os.path.join(d, p + ".js")),
                 os.path.normpath(os.path.join(d, p + ".ts")),
                 os.path.normpath(os.path.join(d, p + ".sh"))]
        return cands[0]
    base = os.path.basename(p)
    for ext in (".py", ".js", ".ts", ".cpp", ".h", ".sh"):
        if base.endswith(ext):
            return base
    return base


class ImportCyclesPlugin(MetricPlugin):
    name = "import_cycles"

    def describe(self):
        return "static import graph cycles (repo-level)"

    def analyze_file(self, path, source, lang):
        pats = _PATTERNS.get(lang, [])
        edges = set()
        for line in source.splitlines():
            for pat in pats:
                m = re.search(pat, line)
                if m:
                    edges.add(_resolve(path, m.group(1), lang))
        return FileResult(file_metrics={"imports": sorted(edges)})

    def analyze_repo(self, files: dict) -> dict:
        names = {os.path.basename(p): p for p in files}
        graph = {}
        for path, src in files.items():
            lang = "py" if path.endswith(".py") else \
                   "ts" if path.endswith((".ts", ".tsx")) else \
                   "js" if path.endswith((".js", ".jsx")) else "other"
            r = self.analyze_file(path, src, lang)
            graph[path] = {names.get(os.path.basename(e), e)
                           for e in r.file_metrics["imports"]}
            graph[path] = {g for g in graph[path] if g in files}
        cycles, stack, visited = [], [], set()

        def dfs(node, trail):
            visited.add(node)
            trail.append(node)
            for nxt in graph.get(node, ()):
                if nxt in trail:
                    cycles.append(trail[trail.index(nxt):] + [nxt])
                elif nxt not in visited:
                    dfs(nxt, trail)
            trail.pop()

        for n in graph:
            if n not in visited:
                dfs(n, [])
        in_cycle = {n for c in cycles for n in c}
        return {"cycles": cycles, "files_in_cycles": sorted(in_cycle),
                "cycle_count": len(cycles)}
