"""LOC/SLOC/blank/comment per file (language-agnostic classifier)."""
from __future__ import annotations
from .base import FileResult, MetricPlugin
from historian.langutil import count_loc


class LocPlugin(MetricPlugin):
    name = "loc"

    def describe(self):
        return "loc/sloc/blank/comment line counts"

    def analyze_file(self, path, source, lang):
        loc, sloc, blank, comment = count_loc(source)
        return FileResult(file_metrics={"loc": loc, "sloc": sloc,
                                        "blank": blank, "comment": comment})
