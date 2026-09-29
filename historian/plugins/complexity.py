"""Complexity mass + erosion contribution (mass = CC*sqrt(SLOC))."""
from __future__ import annotations
from .base import FileResult, MetricPlugin
from historian import formulas
from historian.langutil import analyze_functions


class ComplexityPlugin(MetricPlugin):
    name = "complexity"

    def describe(self):
        return "mass(f)=CC*sqrt(SLOC) + erosion contribution per file"

    def analyze_file(self, path, source, lang):
        funcs = analyze_functions(path, source, lang)
        mass = sum(formulas.mass(f.cc, f.sloc) for f in funcs)
        er = formulas.erosion(funcs)
        return FileResult(
            file_metrics={"mass": mass, "erosion": er,
                          "functions_over_10": sum(1 for f in funcs if f.cc > 10)},
            functions=funcs)
