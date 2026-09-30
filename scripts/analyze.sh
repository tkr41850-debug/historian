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

# Args are order-independent: any KEY=VALUE (KEY in out|outdir|config|
# commits|codegen|plugins|jobs) routes to its key wherever it appears, so
# `just analyze . commits=50` works even though just passes args
# positionally. A bare value keeps its positional meaning (repo first).
_raw1="${1:-}"; _raw2="${2:-}"; _raw3="${3:-}"; _raw4="${4:-}"
_raw5="${5:-}"; _raw6="${6:-}"; _raw7="${7:-}"; _raw8="${8:-}"
if [ -z "$_raw1" ] || [ "$_raw1" = "-h" ] || [ "$_raw1" = "--help" ]; then
    # Bare `just analyze` shows the analyzer help menu.
    uv run python -m historian --help
    exit 0
fi
repo=""; out=""; outdir=""; cfg=""; commits=""; codegen=""; plugins=""; jobs=""
_k=""  # global (no `local`): route() runs under set -e, so every path
       # must exit 0; plain assignments keep that invariant.
route() {  # $1 value, $2 positional slot it falls back to
    # Empty positionals (just fills all 8 with "") never clobber.
    [ -z "$1" ] && return 0
    # KEY=VALUE routes by key wherever it appears (just passes args
    # positionally, so `just analyze . commits=50` lands commits=50 in
    # slot 2). Only bare keys route: a path like "myout=x.json" keeps
    # its positional meaning.
    case "$1" in
        *=*) _k="${1%%=*}" ;;
        *) printf -v "$2" '%s' "$1"; return 0 ;;
    esac
    case "$_k" in
        repo|out|outdir|commits|codegen|plugins|jobs)
            printf -v "$_k" '%s' "${1#*=}" ;;
        config)
            cfg="${1#*=}" ;;
        *) printf -v "$2" '%s' "$1" ;;
    esac
    return 0
}
route "$_raw1" repo; route "$_raw2" out; route "$_raw3" outdir; route "$_raw4" cfg
route "$_raw5" commits; route "$_raw6" codegen; route "$_raw7" plugins
route "$_raw8" jobs
if [ -z "$repo" ]; then
    # Flags but no repo (e.g. `just analyze commits=50`): show help.
    uv run python -m historian --help
    exit 0
fi

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
