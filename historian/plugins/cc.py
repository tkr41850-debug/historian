"""Cyclomatic complexity per function via lizard (C++/py/js/ts + shell fallback)."""
from __future__ import annotations
from .base import FileResult, MetricPlugin
from historian.langutil import analyze_functions


class CcPlugin(MetricPlugin):
    name = "cc"

    def describe(self):
        return "cyclomatic complexity per function (lizard)"

    def analyze_file(self, path, source, lang):
        funcs = analyze_functions(path, source, lang)
        top = max([f.cc for f in funcs], default=0)
        return FileResult(
            file_metrics={"functions": [
                {"name": f.name, "cc": f.cc, "sloc": f.sloc,
                 "start": f.start_line, "end": f.end_line} for f in funcs],
                "cc_max": top,
                "cc_avg": sum(f.cc for f in funcs) / len(funcs) if funcs else 0.0},
            functions=funcs)
