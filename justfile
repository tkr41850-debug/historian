# Historian runners. `just analyze <repo>`, `just serve`.
# Install just: https://just.systems (or `cargo install just`).
# Recipes document themselves: `just --list`.

# List all recipes (default).
default:
    @just --list

# Analyze a repo into {repo}-history.json.
# Params: out= (default {repo}-history.json), config= (default historian.config.yaml if present),
#   commits= (last N commits, default all), codegen=on|off (default: config intent),
#   plugins= (space-separated name=on|off overrides, e.g. 'plugins="verbosity=off cc=on"').
# Examples:
#   just analyze /path/to/repo
#   just analyze /path/to/repo out=my.json config=other.yaml
#   just analyze /path/to/repo commits=50 codegen=on plugins="verbosity=off"
analyze repo out="" config="" commits="" codegen="" plugins="":
    bash scripts/analyze.sh {{ quote(repo) }} {{ quote(trim_start_match(out, "out=")) }} {{ quote(trim_start_match(config, "config=")) }} {{ quote(trim_start_match(commits, "commits=")) }} {{ quote(trim_start_match(codegen, "codegen=")) }} {{ quote(trim_start_match(plugins, "plugins=")) }}

# Serve the dashboard locally (vite dev server, root path — for local editing only).
serve:
    npm --prefix web ci --no-audit --no-fund
    npm --prefix web run dev

# Preview the production build (relative ./ base, same as GitHub Pages serves it).
preview:
    npm --prefix web ci --no-audit --no-fund
    npm --prefix web run build
    mkdir -p web/dist/minimal && cp web/minimal/index.html web/minimal/app.js web/dist/minimal/ && cp web/sample.json web/dist/sample.json
    npm --prefix web run preview

# Regenerate both sample.json copies (web/sample.json + web/src/sample.json) from a real runner pass.
sample:
    uv run python web/make_sample.py

# Full local check suite (mirrors CI: pytest + build + vitest + smoke).
check:
    uv run --frozen --group dev pytest -q
    npm --prefix web ci --no-audit --no-fund
    npm --prefix web run build
    npm --prefix web test -- --run
    node web/minimal/smoke.cjs
    uv run python web/make_sample.py
    git diff --exit-code -- web/sample.json web/src/sample.json
