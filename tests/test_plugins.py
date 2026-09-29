"""Per-plugin tests on fixture sources with known answers."""
from historian.plugins.loc import LocPlugin
from historian.plugins.cc import CcPlugin
from historian.plugins.complexity import ComplexityPlugin
from historian.plugins.duplication import DuplicationPlugin
from historian.plugins.import_cycles import ImportCyclesPlugin
from historian.plugins.verbosity import VerbosityPlugin

BRANCHY = "def f(x):\n" + "".join(
    f"    if x == {i}:\n        x += 1\n" for i in range(12)) + "    return x\n"

DUP = "\n".join([f"line{i} = {i}" for i in range(6)] * 2) + "\n"

def test_loc_counts():
    r = LocPlugin().analyze_file("a.py", "import os\n\n# hi\nx = 1\n", "py")
    assert r.file_metrics == {"loc": 4, "sloc": 2, "blank": 1, "comment": 1}

def test_cc_branchy_over_threshold():
    r = CcPlugin().analyze_file("b.py", BRANCHY, "py")
    assert r.file_metrics["cc_max"] > 10
    assert len(r.functions) == 1

def test_complexity_erosion_full():
    r = ComplexityPlugin().analyze_file("b.py", BRANCHY, "py")
    assert r.file_metrics["erosion"] == 1.0
    assert r.file_metrics["functions_over_10"] == 1

def test_duplication_within_file():
    r = DuplicationPlugin().analyze_file("c.py", DUP, "py")
    assert len(r.slop_lines) >= 6
    assert r.slop_kind == "clone"

def test_import_cycle_pair():
    files = {"a.py": "import b\n", "b.py": "import a\n"}
    out = ImportCyclesPlugin().analyze_repo(files)
    assert out["cycle_count"] >= 1
    assert set(out["files_in_cycles"]) == {"a.py", "b.py"}

def test_verbosity_rules():
    src = "import os\nprint('debug')\n# TODO: fix\nx: any = 1\n"
    r = VerbosityPlugin().analyze_file("d.ts", src, "ts")
    assert r.slop_kind == "ast"
    assert len(r.slop_lines) >= 3
