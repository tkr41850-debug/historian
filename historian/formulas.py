"""Paper formulas (from the pasted excerpt).

mass(f) = CC(f) * sqrt(SLOC(f))
Erosion(C) = sum_{CC>10} mass / sum mass
Verbosity(C) = |L_AST ∪ L_clone| / LOC
Velocities β_V, β_E via least-squares fit of metric vs commit index.
"""

from __future__ import annotations

import math


def mass(cc: int, sloc: int) -> float:
    return cc * math.sqrt(max(sloc, 0))


def erosion(functions, cc_threshold: int = 10) -> float:
    total = sum(mass(f.cc, f.sloc) for f in functions)
    if total <= 0:
        return 0.0
    over = sum(mass(f.cc, f.sloc) for f in functions if f.cc > cc_threshold)
    return over / total


def verbosity(ast_lines, clone_lines, loc: int) -> float:
    if loc <= 0:
        return 0.0
    return len(set(ast_lines) | set(clone_lines)) / loc


def linear_fit(xs, ys):
    """Least-squares (slope, intercept) of y over x."""
    n = len(xs)
    if n == 0:
        return 0.0, 0.0
    if n == 1:
        return 0.0, float(ys[0])
    mx = sum(xs) / n
    my = sum(ys) / n
    den = sum((x - mx) ** 2 for x in xs)
    if den == 0:
        return 0.0, my
    slope = sum((x - mx) * (y - my) for x, y in zip(xs, ys)) / den
    return slope, my - slope * mx
