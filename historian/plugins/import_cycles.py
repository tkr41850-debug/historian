"""Static import graph + cycle detection (py/js/ts/c++/sh).

Parses per-language import/include/source statements with regexes,
builds a module graph, reports elementary cycles (Johnson-lite DFS)
and per-file in-cycle flags. stdlib only.

JS/TS covers both module systems:

- ESM: ``import ... from '...'``, side-effect ``import '...'``,
  ``export ... from '...'`` re-exports (including ``export *``,
  ``export * as ns`` and ``export type``), and dynamic
  ``import('...')`` with a static string argument.
- CJS: ``require('...')`` / ``require.resolve('...')`` (which also
  covers ``import x = require('...')`` and ``module.exports =
  require('...')``). Bare ``module.exports = ...`` /
  ``exports.x = ...`` / ``export = ...`` forms reference no other
  module, so they contribute no edge by design.

Unresolvable imports (missing files, bare specifiers such as
``'lodash'``, dynamic expressions such as ``require('./' + name)``
or template literals) are ignored as graph edges: they never crash
analysis and never create phantom nodes.
"""
from __future__ import annotations
import os
import re
from .base import FileResult, MetricPlugin

# Full-source regexes for JS/TS (run with finditer over the whole file
# so multi-line import/export statements are caught). Group 1 is the
# raw specifier in every pattern.
_JS_TS = [
    # ESM static import + re-export, single- or multi-line:
    #   import x from './a'; import './polyfill';
    #   export * from './s'; export {a} from "./b";
    #   export * as ns from '../u'; export type {T} from './t'
    # Never crosses quotes or ';', so matching stays in one statement.
    r"""\b(?:import|export)\b[^'";]*?\bfrom\s*['"]([^'"]+)['"]""",
    # side-effect import: import './polyfill';
    r"""\bimport\s*['"]([^'"]+)['"]""",
    # dynamic import('./lazy') with a static string; an optional
    # bundler comment (/* webpackChunkName: "c" */) is skipped.
    # import.meta has no paren+string, so it never matches.
    r"""\bimport\(\s*(?:/\*.*?\*/\s*)?['"]([^'"]+)['"]\s*\)""",
    # CJS: require('./a'), require.resolve('./p'),
    # import a = require('./a'). Non-string-literal arguments
    # (concatenation, template literals, path.join) never match.
    r"""\brequire(?:\.resolve)?\(\s*(?:/\*.*?\*/\s*)?['"]([^'"]+)['"]\s*\)""",
]

_PATTERNS = {
    "py": [r"^\s*(?:from|import)\s+([\w.]+)"],
    "js": _JS_TS,
    "ts": _JS_TS,
    "other-code": [r'^\s*#\s*include\s+"([^"]+)"'],
    "sh": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
    "shell": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
    "bash": [r"^\s*(?:source|\.)\s+([^\s;#]+)"],
}

# Languages whose patterns run against the whole source at once
# (rather than line by line).
_FULL_SOURCE = {"js", "ts"}


def _resolve(base_path, raw, lang):
    """Map a raw specifier to a lookup key for analyze_repo.

    Never raises on odd input; returns "" when there is nothing to
    resolve. Known extensions (including .mjs/.cjs/.jsx/.tsx) are
    preserved as-is; extensionless "./foo" stays extensionless and is
    matched by stem/index probing in analyze_repo.
    """
    try:
        raw = (raw or "").strip().strip("'\"")
    except Exception:
        return ""
    if lang == "py":
        head = raw.split(".")[0].strip()
        return (head + ".py") if head else ""
    p = raw.split("?")[0].split("#")[0].strip()
    if not p:
        return ""
    if p.startswith("."):
        res = os.path.normpath(os.path.join(os.path.dirname(base_path), p))
        # Degenerate specifiers such as require('./' + name) can capture
        # a bare "./"; they resolve to nothing and must not become edges.
        return res if res not in (".", "") else ""
    return os.path.basename(p.rstrip("/")) or ""


class ImportCyclesPlugin(MetricPlugin):
    name = "import_cycles"

    def describe(self):
        return "static import graph cycles (repo-level)"

    def analyze_file(self, path, source, lang):
        pats = _PATTERNS.get(lang, [])
        edges = set()
        try:
            if lang in _FULL_SOURCE:
                for pat in pats:
                    for m in re.finditer(pat, source):
                        e = _resolve(path, m.group(1), lang)
                        if e:
                            edges.add(e)
            else:
                for line in source.splitlines():
                    for pat in pats:
                        m = re.search(pat, line)
                        if m:
                            e = _resolve(path, m.group(1), lang)
                            if e:
                                edges.add(e)
        except Exception:
            pass
        return FileResult(file_metrics={"imports": sorted(edges)})

    def analyze_repo(self, files: dict) -> dict:
        from historian.git import lang_of
        by_base = {}
        for p in files:
            by_base.setdefault(os.path.basename(p), p)
        # Extension probing: stem map ('foo' -> foo.js/foo.ts/...) and
        # directory-index map ('./dir' -> dir/index.js, 'src/dir' path).
        by_stem, by_path = {}, {}
        for p in files:
            norm = os.path.normpath(p)
            stem_path, _ext = os.path.splitext(norm)
            by_path.setdefault(stem_path, p)
            by_stem.setdefault(os.path.basename(stem_path), p)
            if os.path.basename(stem_path) == "index":
                by_path.setdefault(os.path.dirname(stem_path) or ".", p)
                parent = os.path.basename(os.path.dirname(norm))
                if parent:
                    by_stem.setdefault(parent, p)
        graph = {}
        for path, src in files.items():
            r = self.analyze_file(path, src, lang_of(path))
            resolved = set()
            for e in r.file_metrics["imports"]:
                if not e:
                    continue
                hit = by_base.get(os.path.basename(e))
                if hit is None:
                    hit = by_path.get(os.path.normpath(e))
                if hit is None:
                    base = os.path.basename(e)
                    stem, ext = os.path.splitext(base)
                    hit = by_stem.get(stem if ext else base)
                # Unresolvable imports are ignored: no crash, and no
                # phantom nodes enter the graph.
                if hit is not None and hit in files:
                    resolved.add(hit)
            graph[path] = resolved
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
