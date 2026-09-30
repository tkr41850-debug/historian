"""Drop-in metric plugin contract.

To add a metric: create ``historian/plugins/<name>.py`` containing a
concrete ``MetricPlugin`` subclass. It is auto-discovered. Enable/disable
via the ``plugins:`` map in ``historian.config.yaml`` — no core edits.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class FunctionStat:
    name: str
    cc: int
    sloc: int
    start_line: int
    end_line: int


@dataclass
class FileResult:
    """Per-file output of one plugin.

    slop_lines: 1-based line numbers flagged by this plugin.
    slop_kind: "ast" | "clone" | "" — used for the verbosity union
        (L_AST ∪ L_clone). Non-slop metrics use "".
    """

    file_metrics: dict = field(default_factory=dict)
    slop_lines: set = field(default_factory=set)
    slop_kind: str = ""
    functions: list = field(default_factory=list)


class MetricPlugin:
    """Base class for metric plugins.

    Instances are shared across worker threads; analyze_* must not
    mutate self (keep all state in locals).
    """

    name = "base"

    def describe(self) -> str:
        return self.name

    def analyze_file(self, path: str, source: str, lang: str) -> FileResult:
        raise NotImplementedError

    def analyze_repo(self, files: dict) -> dict:
        """Optional repo-level pass (e.g. import cycles)."""
        return {}
