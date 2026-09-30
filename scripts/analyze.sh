#!/usr/bin/env bash
# Analyze a repo (output path resolved by the CLI: explicit out= wins,
# else {outdir}/history-{repo}.json with outdir defaulting to ".").
# Args: repo out outdir config commits codegen plugins jobs (empty = default).
# Invoked via `bash scripts/analyze.sh ...` (explicit interpreter, so it
# works even when temp dirs are mounted noexec, where just's shebang
# recipes cannot execute).
set -euo pipefail

command -v uv >/dev/null || {
    echo "uv not found — install it: curl -LsSf astral.sh/uv/install.sh | sh" >&2
    exit 127
}

repo="${1:?usage: analyze.sh <repo> [out] [outdir] [config] [commits] [codegen] [plugins] [jobs]}"
out="${2:-}"
outdir="${3:-}"
cfg="${4:-}"
commits="${5:-}"
codegen="${6:-}"
plugins="${7:-}"
jobs="${8:-}"

# Accept KEY=VALUE or bare values (just passes `out=x` through when the
# recipe param is named `out`; strip the prefix if present).
out="${out#out=}"
outdir="${outdir#outdir=}"
cfg="${cfg#config=}"
commits="${commits#commits=}"
codegen="${codegen#codegen=}"
plugins="${plugins#plugins=}"
jobs="${jobs#jobs=}"

# Output naming lives in historian/__main__.py resolve_out(); pass both
# through and let explicit --out win there.
[ -z "$cfg" ] && [ -f historian.config.yaml ] && cfg="historian.config.yaml"

args=(--repo "$repo")
[ -n "$out" ] && args+=(--out "$out")
[ -n "$outdir" ] && args+=(--outdir "$outdir")
[ -n "$cfg" ] && args+=(--config "$cfg")
[ -n "$commits" ] && args+=(--commits "$commits")
case "$codegen" in
    on|yes|true|--codegen) args+=(--codegen) ;;
    off|no|false|--no-codegen) args+=(--no-codegen) ;;
    "") ;;
    *) echo "codegen must be on|off, got: $codegen" >&2; exit 1 ;;
esac
if [ -n "$plugins" ]; then
    # shellcheck disable=SC2086
    for p in $plugins; do args+=(--plugin "$p"); done
fi
[ -n "$jobs" ] && args+=(--jobs "$jobs")
uv run python -m historian "${args[@]}"
