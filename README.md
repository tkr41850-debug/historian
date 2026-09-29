# Historian — repo slop trajectory (verbosity + structural erosion)

Tracks `Verbosity(C)` and `Erosion(C)` per commit, per file, with a
drop-in Python plugin system and a React+TS dashboard.

Formulas (from pasted paper excerpt):

- `mass(f) = CC(f) * sqrt(SLOC(f))`
- `Erosion(C) = sum_{f: CC>10} mass(f) / sum_f mass(f)`
- `Verbosity(C) = |L_AST ∪ L_clone| / LOC`
- Trajectory `T = {(t, V_t, E_t)}`, velocities β_V, β_E via linear fit.

## Layout

- `historian/` — python package + CLI (`uv run python -m historian`)
- `historian/plugins/` — drop-in metric plugins (enabled via config)
- `tests/` — pytest per plugin + integration
- `web/` — React+TS Vite dashboard (`web/src`, drag-drop JSON) +
  zero-dep table lens (`web/minimal/`)
- `historian.config.yaml` — codegen + plugin enable/disable + github URL

## Quickstart

```bash
uv sync
cp historian.config.yaml.example historian.config.yaml  # set github_url
uv run python -m historian --repo /path/to/repo --out historian.json \
  --config historian.config.yaml
```

Multi-language analysis (C++/Python/JS/TS) uses `lizard` (a sync
dependency — erosion silently degrades to CC=1 pseudo-functions without
it); Shell (`.sh`/`.bash`) uses a built-in keyword heuristic.

## CLI reference

```
--repo PATH        target git repo (required)
--out FILE         output JSON (required)
--config FILE      historian.config.yaml (optional)
--commits N        analyze last N commits (alias: --max-commits)
--codegen          run config `codegen:` command in repo first
--no-codegen       never run codegen (overrides config intent)
--include a b      only analyze paths containing these
--exclude a b      skip paths containing these
--plugin n=on|off  enable/disable one plugin (repeatable)
```

Record shape: `{meta, config, commits:[{sha,time,author,email,
subject,body,permalink,files:{path:{plugin:metrics}},repo:{plugin:
repo-metrics},commit:{loc,verbosity,erosion,functions,cc_avg}}]}`.
`permalink` is `{github_url}/commit/{sha}` when `github_url` is set.

## Config reference (`historian.config.yaml`)

- `codegen:` shell command run with cwd=repo before analysis when
  `--codegen` is passed (e.g. `"npm run codegen"`); `null` skips.
- `pre-commit:` copy `.pre-commit-config.yaml.example` — hook runs
  codegen first, then metrics.
- `github_url:` base URL for permalinks.
- `cc_threshold:` erosion CC cutoff (paper: 10).
- `plugins:` map of plugin stem → enabled (`loc/cc/complexity/
  duplication/import_cycles/verbosity`).
- `include/exclude:` path-substring filters.

## Writing a plugin

Create `historian/plugins/<name>.py` with a `MetricPlugin` subclass:

```python
from .base import FileResult, MetricPlugin

class MyPlugin(MetricPlugin):
    name = "mine"  # key in files[path], toggled via plugins: map
    def analyze_file(self, path, source, lang):
        return FileResult(file_metrics={"mine": 1})
    # optional: def analyze_repo(self, files): return {...}
```

Use `slop_lines={...}` + `slop_kind="ast"|"clone"` to feed the
verbosity union; attach `functions=[FunctionStat(...)]` to feed erosion.
Add a test in `tests/test_plugins.py`.

## Web UI

```bash
cd web && npm install && npm run dev      # dashboard (drag historian.json on)
# or open web/minimal/index.html directly (no build)
uv run python web/make_sample.py          # regenerate both sample.json copies
```
