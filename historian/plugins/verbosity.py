"""L_AST: small extensible rule pack (stands in for the paper's AST-grep set).

Rules (regex + optional python-AST assist) — add entries to RULES to extend:
  empty-except-pass | bare-except | print-only-debug | console-log |
  any-cast | todo-stub | commented-code | long-arg-list(>6 via ast) |
  deep-nesting(>4 via ast)
Each hit emits 1-based line numbers with slop_kind="ast".
"""
from __future__ import annotations
import ast
import re
from .base import FileResult, MetricPlugin

RULES = [
    ("empty-except-pass", re.compile(r"^\s*except.*:\s*$")),
    ("bare-except", re.compile(r"^\s*except\s*:\s*$")),
    ("print-debug", re.compile(r"^\s*print\s*\(")),
    ("console-log", re.compile(r"^\s*console\.(log|debug|info)\s*\(")),
    ("any-cast", re.compile(r":\s*any\b|as\s+any\b")),
    ("todo-stub", re.compile(r"#\s*(TODO|FIXME|XXX|HACK)\b|//\s*(TODO|FIXME|XXX|HACK)\b")),
    ("commented-code", re.compile(r"^\s*#\s*(def |class |return |import |if |for )")),
]


def _ast_hits(source):
    hits = set()
    try:
        tree = ast.parse(source)
    except SyntaxError:
        return hits
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and len(node.args.args) > 6:
            hits.add(node.lineno)
        depth, cur = 0, node
        # nesting estimated per function below
    # deep nesting: walk with depth
    def walk(n, d):
        if isinstance(n, (ast.If, ast.For, ast.AsyncFor, ast.While, ast.With, ast.Try)):
            d += 1
            if d > 4 and hasattr(n, "lineno"):
                hits.add(n.lineno)
        for c in ast.iter_child_nodes(n):
            walk(c, d)
    try:
        walk(tree, 0)
    except RecursionError:
        pass
    # pass-only except bodies
    for node in ast.walk(tree):
        if isinstance(node, ast.ExceptHandler) and len(node.body) == 1 \
                and isinstance(node.body[0], ast.Pass):
            hits.add(node.lineno)
    return hits


class VerbosityPlugin(MetricPlugin):
    name = "verbosity"

    def describe(self):
        return "L_AST rule-pack hits (+ union done in runner)"

    def analyze_file(self, path, source, lang):
        hits = set()
        for lineno, line in enumerate(source.splitlines(), 1):
            for _, rx in RULES:
                if rx.search(line):
                    hits.add(lineno)
                    break
        if lang == "py":
            hits |= _ast_hits(source)
        return FileResult(file_metrics={"ast_hits": sorted(hits),
                                        "rules": [n for n, _ in RULES]},
                          slop_lines=hits, slop_kind="ast")
