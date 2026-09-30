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

## Install

Versions: Python >= 3.10, Node 22 (CI pins 22 via
actions/setup-node@v6; newer local node is untested), just >= 1.36,
uv >= 0.5.

```bash
curl -LsSf astral.sh/uv/install.sh | sh
# node 22 via nvm/fnm/your package manager
cargo install just            # or https://just.systems
just --version                # verify just is on PATH

git clone <this-repo> && cd historian
node --version                # want v22.x to match CI
uv sync                       # python deps (lizard, pyyaml) + dev group on demand
cp historian.config.yaml.example historian.config.yaml  # set github_url
```

No `historian.config.yaml` in the repo root is expected — you create it
from the `.example` (it is gitignored). Without `--config`, analysis runs
with runner defaults and no permalinks.

## Standard use (just recipes)

```bash
just                               # same as just --list: all recipes
just analyze /path/to/repo         # -> ./history-{repo}.json (uses historian.config.yaml if present)
just analyze /path/to/repo outdir=/tmp/histories
just analyze /path/to/repo out=my.json config=other.yaml
just analyze /path/to/repo commits=50 codegen=on plugins="verbosity=off" jobs=4
just serve                         # vite dev server for local editing (root path /)
just preview                       # prod build preview, same relative ./ base Pages serves
just sample                        # regenerate web/sample.json + web/src/sample.json fixtures
just check                         # full suite: pytest + build + vitest + smoke
```

`analyze` knobs:

- `out=FILE` — explicit output path (wins over `outdir`).
- `outdir=DIR` — output directory, written as `{outdir}/history-{repo}.json`
  (history- prefix groups analyses under ls sorting; default: cwd).
- `commits=N` — analyze last N commits (default: all).
- `codegen=on|off` — run the config `codegen:` command first, or skip it
  (default: neither flag, config intent stands).
- `plugins="a=on b=off"` — per-plugin overrides, space-separated pairs
  (default: `plugins:` map in config).
- `jobs=N` — parallel commit-analysis workers (default: all cpus; 1 = serial).

For `--include`/`--exclude` path filters or repeated `--plugin` flags,
call the raw CLI below instead of `just analyze`.

Raw CLI without just:

```bash
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
--jobs N           parallel workers (default: all cpus; 1 = serial)
--no-progress      disable the tqdm statusline
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
just serve                         # dashboard dev (drag historian.json on)
just preview                       # prod build preview
# or open web/minimal/index.html directly (no build)
just sample                        # regenerate both sample.json copies
```

Deployed via GitHub Pages (`.github/workflows/ci-pages.yml`):
dashboard at the site root, table lens at `minimal/`, shared
fixture at `sample.json`. The Vite `base: "./"` keeps every asset
relative, so the site works from a subpath
(`https://HOST/subpath/`) as well as the domain root.
