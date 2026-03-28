## Section A: Change understanding

Key implementation points (verified in code):
- Detection logic lives in [local.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/local.ts) and [package.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/inspection/package.ts).
- Scoring mappings/weights live in [context.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/categories/context.ts), [tooling.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/categories/tooling.ts), [feedback.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/categories/feedback.ts), and [index.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/scoring/index.ts).
- Deep check IDs/category binding is in [checks.ts](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/src/agents/checks.ts).  
- Plan alignment confirmed in [harness-engineering-implementation-plan.md](/Users/ivan.jovanovikj/Documents/Playground/agent-harness-audit/harness-engineering-implementation-plan.md).

New Phase 1 checks:

1. `has_docs_index`
- Detection: `docs/index.(md|mdx|txt)` or `docs/README.(md|mdx|txt)` (top-level under `docs/`).
- Category/impact: `context`, weight `0.15` inside context (`0.20` category weight) => ~`3` overall score points.
- FP/FN:
  - FN: docs entrypoint in other names (`docs/home.md`, `mkdocs.yml`, docs site config).
  - FN: nested index not at `docs/` root.

2. `has_structured_docs`
- Detection: in `docs/`, passes if any subdirectory exists OR at least 2 markdown/text files.
- Category/impact: `context`, weight `0.20` => ~`4` overall points.
- FP/FN:
  - FP: any empty subdir in `docs/` passes.
  - FN: single rich architecture doc can fail if no subdir and only 1 file.

3. `has_local_dev_boot_path`
- Detection: root `package.json` scripts include `dev|start|preview|serve(:*)` (excluding build-like commands) OR command starts with known dev boot commands.
- Category/impact: `tooling`, weight `0.20` => ~`5` overall points.
- FP/FN:
  - FN: monorepo boot scripts in subpackages only.
  - FN: nonstandard scripts (`up`, `run-local`, Make targets).
  - FP: script name matches but doesn’t actually boot app.

4. `has_ci_validation`
- Detection: only `.github/workflows/*.yml|yaml`; requires `push|pull_request` text and validation command regex match.
- Category/impact: `feedback`, weight `0.20` => ~`5` overall points.
- FP/FN:
  - FN: GitLab/Bitbucket/Circle/Jenkins CI.
  - FN: reusable/action-based workflows without direct command strings.
  - FP: regex hits comments/non-validation steps.

5. `has_e2e_or_smoke_tests`
- Detection: Playwright config at root OR root-level `*.e2e.*|*.smoke.*` files OR `e2e|smoke|e2e-tests|smoke-tests` dirs in root/test roots containing files.
- Category/impact: `feedback`, weight `0.20` => ~`5` overall points.
- FP/FN:
  - FN: Cypress/Webdriver setups not matching patterns.
  - FN: deep nested test dirs with no direct files in immediate directory.
  - FP: naming-only matches that are not executable tests.

6. `has_architecture_lints`
- Detection: root dependency-cruiser config file OR root `package.json` deps include `dependency-cruiser` or `eslint-plugin-boundaries`.
- Category/impact: `tooling`, weight `0.15` => ~`3.75` overall points.
- FP/FN:
  - FN: tooling configured in subpackages only.
  - FN: other boundary tools (Nx module boundaries, custom ESLint rules).
  - FP: dependency exists but unused.

---

## Section B: Raw run summary (commands + pass/fail + key outputs)

Run directory: `/tmp/agent-harness-runs-20260328-204431`

1. `npm run build`
- Pass
- Output: `tsc` completed cleanly.

2. `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal`
- Pass
- Key output: overall `28/100`, `Context 2.4/5`, `Tooling 0/5`, `Feedback 0/5`.

3. `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --json`
- Pass
- Key output: same scoring as text.

4. `node dist/cli.js audit ... --deep --agent claude-code`
- First batch run: Fail (`requested agent is not available: claude-code`).
- Re-run during verification: Pass, same score (`28/100`), deep evidence attached, no score/check changes.

5. `node dist/cli.js audit ... --deep --agent claude-code --json`
- Pass
- Key output: valid JSON report with `deepAudit.findings=22`; scoring unchanged vs normal.

6. `node dist/cli.js audit ... --deep --agent codex`
- Fail
- Error: Codex state DB migration mismatch in `~/.codex/state_5.sqlite` (adapter exits 1).

7. `node dist/cli.js audit ... --deep --agent codex --json`
- Fail
- Same Codex state DB error.

Normal vs deep summary:
- Deep (Claude) did not alter any check verdicts or category scores (`0` check diffs).

---

## Section C: New-check evaluation table

| Check | Portal result | Correct? | Verdict | Recommendation |
|---|---:|---|---|---|
| `has_docs_index` | Fail | Likely correct (`docs/` has no root index/readme) | Good signal | Keep; broaden accepted index conventions (`home.md`, mkdocs/docusaurus configs). |
| `has_structured_docs` | Pass | Correct for portal (real nested docs) but logic is weak | Weak signal | Tune; require non-empty subtree with at least N docs files across sections. |
| `has_local_dev_boot_path` | Fail | Misleading for this monorepo (boot scripts exist in `backend/`/`frontend/`) | Weak signal | Tune; detect workspace/subpackage scripts + Makefile/dev orchestration. |
| `has_ci_validation` | Fail | Partly misleading: portal has CI (`.gitlab-ci.yml`) but check only scans GitHub workflows | Weak signal | Tune; support GitLab and distinguish `has_ci_pipeline` vs `has_ci_validation_commands`. |
| `has_e2e_or_smoke_tests` | Fail | Likely correct (only plans/docs, no concrete e2e assets found) | Good signal | Keep; add Cypress patterns and recursive dir scan. |
| `has_architecture_lints` | Fail | Probably correct at repo level; may miss subpackage config | Medium signal | Keep; add monorepo-aware scan and more boundary-tool signatures. |

Score/fix-plan impact in this run:
- Triggered fails: `has_local_dev_boot_path` (fix priority 4), `has_e2e_or_smoke_tests` (6), `has_ci_validation` (7), `has_architecture_lints` (8), `has_docs_index` (13).
- `has_structured_docs` passed.
- None entered top-3 blockers due lower relative impact than existing failures.

---

## Section D: Problems found (bugs/noise/edge cases)

1. Monorepo false negatives are severe
- Root-only `package.json`, lockfile, scripts, and lint-dependency checks collapse tooling/feedback scores for repos like `portal`.

2. CI detection is GitHub-only
- `.gitlab-ci.yml` is ignored completely, so CI presence/validation in non-GitHub repos is missed.

3. `has_structured_docs` can pass on empty structure
- Any subdirectory under `docs/` causes immediate pass, even without useful docs content.

4. JSON mode error shape is unstable
- On failure (`--json` + deep codex), output is plain `Error: ...` text, not JSON. This breaks schema expectations.

5. Deep mode value is currently limited
- For this repo, deep findings added evidence text only; no check deltas. Good for explainability, low incremental detection value pre-Phase-2 context expansion.

---

## Section E: Recommended next actions (prioritized)

1. Add monorepo-aware inspection before Phase 2
- Detect workspaces and scan top-level package roots (`backend/`, `frontend/`, etc.) for scripts, lockfiles, lint boundaries, and test signals.
- Report both root and subpackage evidence.

2. Split CI into two checks and expand providers
- `has_ci_pipeline` (GitHub/GitLab/etc.).
- `has_ci_validation` (actual lint/test/typecheck/build execution in CI).
- Add GitLab parser path (`.gitlab-ci.yml`) and reuse existing command regex logic.

3. Tighten weak heuristics
- `has_structured_docs`: require at least 2 markdown files across docs tree and reject empty subdirs.
- `has_e2e_or_smoke_tests`: recursive scan + include Cypress conventions.
- `has_local_dev_boot_path`: include Make targets and workspace script forwarding patterns.
