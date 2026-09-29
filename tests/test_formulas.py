"""Formula unit tests: hand-computed erosion/verbosity/velocities."""
from historian import formulas
from historian.plugins.base import FunctionStat

def test_mass():
    assert formulas.mass(4, 16) == 16.0

def test_erosion_splits_mass():
    # f1: CC=4,SLOC=16 -> mass 16 ; f2: CC=12,SLOC=9 -> mass 36
    fs = [FunctionStat("a", 4, 16, 1, 10), FunctionStat("b", 12, 9, 11, 20)]
    assert abs(formulas.erosion(fs) - 36 / 52) < 1e-9

def test_erosion_empty():
    assert formulas.erosion([]) == 0.0

def test_verbosity_union():
    # union avoids double-counting line 3
    assert formulas.verbosity({2, 3}, {3, 4}, 10) == 0.3

def test_verbosity_zero_loc():
    assert formulas.verbosity({1}, {2}, 0) == 0.0

def test_linear_fit_slope():
    s, _ = formulas.linear_fit([0, 1, 2, 3], [0.1, 0.2, 0.3, 0.4])
    assert abs(s - 0.1) < 1e-9
