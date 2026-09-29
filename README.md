# Historian — repo slop trajectory (verbosity + structural erosion)

Tracks `Verbosity(C)` and `Erosion(C)` per commit, per file, with a
drop-in Python plugin system and a React+TS dashboard.

Formulas (from pasted paper excerpt):

- `mass(f) = CC(f) * sqrt(SLOC(f))`
- `Erosion(C) = sum_{f: CC>10} mass(f) / sum_f mass(f)`
- `Verbosity(C) = |L_AST ∪ L_clone| / LOC`
- Trajectory `T = {(t, V_t, E_t)}`, velocities β_V, β_E via linear fit.

## Layout

- `historian/` — python package + CLI (`python -m historian`)
- `historian/plugins/` — drop-in metric plugins (enabled via config)
- `tests/` — pytest per plugin + integration
- `web/` — React+TS Vite dashboard (drag-drop JSON)
- `historian.config.yaml` — codegen + plugin enable/disable + github URL

## Quickstart

```bash
pip install pyyaml
python -m historian --repo /path/to/repo --out historian.json
```

See `historian.config.yaml.example`.
