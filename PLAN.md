# Implementation + Test Plan

Source answers (provisional, confirm if wrong): per-file breakdown, drop-in plugins/ + config, run-codegen-first, Vite React+TS dashboard.
Metrics source: pasted paper excerpt (mass/CC>10 erosion, AST∪clone verbosity, trajectory + velocities).

## Parts

### P0 Scaffold + git (this commit)
- `README.md`, `PLAN.md`, `historian.config.yaml.example`, `.gitignore`
- `git init`, initial commit
- Test: `git log --oneline`, `ls` present

### P1 Python core (commit: feat(core))
- `historian/__init__.py`, `__main__.py` (argparse: --repo --out --config --commits --codegen/--no-codegen --include/--exclude globs)
- `historian/git.py`: walk commits via `git log --format=%H|%an|%ae|%at|%s|%b`, per-commit file list via `git ls-tree -r`, checkout-free blob read via `git show SHA:path`
- `historian/plugins/base.py`: `MetricPlugin` protocol (`name`, `describe()`, `analyze_file(path, source, lang) -> {file_metrics, slop_lines, functions:[{name,cc,sloc}]}`)
- `historian/runner.py`: plugin auto-discovery (`plugins/*.py` excluding base), config enable/disable, per-file aggregation into commit record `{sha,time,author,email,subject,body,permalink,files:{},commit:{erosion,verbosity,loc,cc_avg,...}}`
- `historian/formulas.py`: `mass=CC*sqrt(SLOC)`, erosion, verbosity union, linear-fit velocities β
- Config: `historian.config.yaml` (codegen command, pre-commit snippet, plugins enable map, github_url for permalink, threshold cc>10)
- Test: pytest `tests/test_formulas.py` (hand-computed erosion/verbosity), `tests/test_git.py` on fixture repo, `tests/test_runner.py` plugin enable/disable

### P2 Plugins (one commit each: feat(plugin-loc), feat(plugin-cc), feat(plugin-duplication), feat(plugin-import-cycles), feat(plugin-complexity), feat(plugin-verbosity))
- `loc`: LOC/SLOC/blank/comment per file (py/js/ts/yaml-agnostic line classifier)
- `cc`: cyclomatic complexity per function via stdlib `ast` (python) + brace/regex fallback for js/ts (documented approximation)
- `complexity`: mass + erosion contribution per file
- `duplication` (clone): normalized-block hash exact clones ≥6 lines → L_clone
- `import-cycles`: static import graph (py/js/ts) → cycle list + files-in-cycle count (repo-level, merged into commit record)
- `verbosity`: L_AST via small rule pack (empty except/pass, console.log-only, `any`-casts, TODO stubs — stands in for paper's 137 ast-grep rules, extensible) ∪ L_clone → verbosity
- Test per plugin: fixture files with known CC, known clones, known cycle, known slop lines; assert exact numbers

### P3 Codegen + pre-commit (commit: feat(codegen))
- `runner`: if config `codegen: <cmd>` and `--codegen`, run `cmd` (cwd=repo) before analysis; `--no-codegen` skips
- `.pre-commit-config.yaml.example`: hook running `python -m historian --codegen ...` (codegen first, then metrics)
- Test: fixture repo with fake codegen script that creates a file; assert with/without flag differs

### P4 JSON output (commit: feat(json))
- Record shape: `{meta, config, commits:[{sha,time,author,email,subject,body,permalink, files:{path:{metrics}}, commit:{verbosity,erosion,velocities}}]}`
- Permalink: `{github_url}/commit/{sha}` when configured
- Test: golden JSON snapshot on 3-commit fixture repo; validate schema + permalink

### P5 Web UI (commit: feat(web))
- `web/` Vite React+TS: drag-drop JSON, trajectory chart (V_t/E_t), per-file table, author/date/search filters, commit detail, ΔV/ΔE + β display
- Test: `npm run build` passes, manual drag of golden JSON, vitest for velocity math if added

### P6 Docs + E2E (commit: docs/e2e)
- README quickstart, config reference, plugin authoring guide
- E2E: fresh fixture repo → codegen → JSON → drag into `vite dev` → screenshot/record

## Test strategy per part
- Unit (pytest/vitest) for formulas + each plugin in isolation
- Integration: fixture git repo (script-generated, 3-5 commits incl. clone + cycle + complex fn) → full run → golden JSON diff
- UI: build + drag-drop smoke
- Each part commits separately; `pytest -q` + `npm run build` green before commit.

## Ultracode mapping
- P2 plugins: parallel agents (one per plugin) → adversarial verify vs formulas → synthesize
- P5 web: judge panel (dashboard MVP vs minimal-table lens) → winner + graft
- Final: completeness critic (missing modality, unverified claim, unread source)
