#!/usr/bin/env bash
# Analyze a repo into {repo}-history.json.
# Args: repo out config commits codegen plugins (empty = default).
# Invoked via `bash scripts/analyze.sh ...` (explicit interpreter, so it
# works even when temp dirs are mounted noexec, where just's shebang
# recipes cannot execute).
set -euo pipefail

repo="${1:?usage: analyze.sh <repo> [out] [config] [commits] [codegen] [plugins]}"
out="${2:-}"
cfg="${3:-}"
commits="${4:-}"
codegen="${5:-}"
plugins="${6:-}"

# Accept KEY=VALUE or bare values (just passes `out=x` through when the
# recipe param is named `out`; strip the prefix if present).
out="${out#out=}"
cfg="${cfg#config=}"
commits="${commits#commits=}"
codegen="${codegen#codegen=}"
plugins="${plugins#plugins=}"

name="$(basename "$repo" | sed 's/\.git$//')"
[ -z "$out" ] && out="${name}-history.json"
[ -z "$cfg" ] && [ -f historian.config.yaml ] && cfg="historian.config.yaml"

args=(--repo "$repo" --out "$out")
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
uv run python -m historian "${args[@]}"
echo "wrote $out (config: ${cfg:-<none>})"
