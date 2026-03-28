# Harness Engineering Audit Update — Implementation Plan

Date: 2026-03-26
Status: Proposal

## Goal

Implement the harness-engineering audit update in small phases, starting with the highest-signal additions and avoiding scoring churn or overly noisy heuristics.

## Phase 1 — High-Signal Heuristic Checks

### Completed

- [x] `has_docs_index`
- [x] `has_structured_docs`
- [x] `has_local_dev_boot_path`
- [x] `has_ci_validation`
- [x] `has_e2e_or_smoke_tests`
- [x] `has_architecture_lints`
- [x] Monorepo-aware inspection baseline

### Scope

Add these regular audit checks:
- `has_structured_docs`
- `has_local_dev_boot_path`
- `has_ci_validation`
- `has_e2e_or_smoke_tests`
- `has_architecture_lints`

### What to implement

1. Expand evidence collection in `src/inspection/`
- detect docs index files
- detect structured docs directories
- detect local boot scripts from `package.json`
- detect CI workflow validation signals
- detect e2e or smoke-test configs/scripts
- detect architecture-lint or boundary-enforcement signals

2. Extend shared types in `src/types.ts`
- add the new evidence booleans
- add any new check IDs needed by scoring

3. Extend scoring in `src/scoring/categories/`
- map each new signal into an existing category
- keep current five-category model
- do not rebalance weights yet

4. Update output in reporters
- include the new checks in text and JSON output
- keep the current report shape stable

### Category mapping

- `has_docs_index` -> `context`
- `has_structured_docs` -> `context`
- `has_local_dev_boot_path` -> `tooling`
- `has_ci_validation` -> `feedback`
- `has_e2e_or_smoke_tests` -> `feedback`
- `has_architecture_lints` -> `tooling`

### Out of scope

- no scoring rebalance
- no maturity labels
- no niche filename-based checks
- no runtime app execution

### Validation

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Exit criteria

- all 6 new heuristic checks are implemented and tested
- output remains backward-compatible
- no new runtime dependencies

## Phase 1.5 — Hardening From Real-Project Evaluation

### Scope

Address the highest-impact issues found during `portal` evaluation before starting Phase 2:
- monorepo false negatives
- GitHub-only CI detection
- weak structured-docs heuristic
- weak e2e/smoke detection breadth
- unstable JSON error shape on deep failures

### What to implement

1. Monorepo-aware inspection baseline
- Add workspace/package-root discovery in `src/inspection/` for common JS/TS monorepo layouts.
- Aggregate key signals from discovered package roots:
  - local boot scripts
  - architecture lint signals
  - test/e2e signals
  - package/lockfile context
- Keep root-level signals, but allow package-root fallback where appropriate.

2. [x] CI model split and provider expansion
- Add `has_ci_pipeline` (pipeline exists) and keep `has_ci_validation` (validation commands executed).
- Support both:
  - `.github/workflows/*.yml|yaml`
  - `.gitlab-ci.yml`
- Reuse shared command-pattern logic for validation command detection.

3. [x] Tighten `has_structured_docs`
- Require meaningful structure, not just any subdirectory:
  - non-empty subtree and/or minimum markdown file count across docs tree.
- Avoid passing empty placeholder directories.

4. [x] Expand `has_e2e_or_smoke_tests`
- Add recursive directory scan for e2e/smoke paths.
- Add Cypress/Webdriver naming/config patterns.
- Keep Playwright signal support.

5. [x] Stabilize `--json` failure output
- Ensure command failures in JSON mode emit valid JSON error envelopes, not plain-text errors.
- Include machine-readable fields:
  - error code
  - message
  - agent (when relevant)

### File-level task map

1. Inspection and parsing
- `src/inspection/local.ts`
- `src/inspection/package.ts`
- `src/types.ts`

2. Scoring and check metadata
- `src/scoring/categories/context.ts`
- `src/scoring/categories/tooling.ts`
- `src/scoring/categories/feedback.ts`
- `src/scoring/index.ts`
- `src/agents/checks.ts`
- `src/commands/audit.ts`

3. Reporting and CLI error contract
- `src/reporters/text.ts`
- `src/reporters/json.ts`
- `src/cli.ts`

4. Tests and fixtures
- `tests/inspection/local.test.ts`
- `tests/inspection/package.test.ts`
- `tests/scoring/scoring.test.ts`
- `tests/cli.test.ts`
- `tests/commands/audit.deep.test.ts`
- relevant fixture repos under `fixtures/`

### Out of scope

- no Phase 2 excerpt expansion yet
- no scoring weight rebalance
- no hosted telemetry or external APIs

### Validation

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Exit criteria

- monorepo-aware fallback signals are active for Phase 1 checks
- CI checks work for both GitHub and GitLab inputs
- `has_structured_docs` and `has_e2e_or_smoke_tests` show reduced noise on real repos
- deep failures in `--json` mode produce valid JSON output

## Phase 2 — Deep Audit Context Expansion

### Scope

Improve deep mode so the agent sees actual repo context, not just heuristic booleans.

### What to implement

1. Add deterministic excerpt collection
- root file tree summary
- `AGENTS.md` or `CLAUDE.md`
- docs index or top-level docs listing
- package scripts summary
- workflow names
- selected architecture/reliability docs when present

2. Update deep prompt construction in `src/agents/`
- pass excerpts alongside heuristic evidence
- keep prompt size capped and deterministic

3. Extend deep result types
- add `strengths`
- add `risks`
- add `autonomyBlockers`

4. Update deep report rendering
- show these fields in text mode
- include them in JSON mode

### Out of scope

- no maturity taxonomy
- no scoring changes based on new descriptive deep fields
- no arbitrary large file inclusion

### Validation

- unit tests for excerpt selection
- adapter tests for richer response parsing
- integration tests for deep JSON/text output
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Exit criteria

- deep mode includes targeted excerpts
- deep mode returns `strengths`, `risks`, and `autonomyBlockers`
- text and JSON reports render the richer deep result cleanly

## Phase 3 — Deep Audit Harness Review

### Scope

Shift deep mode from narrow boolean verification toward harness assessment.

### What to implement

1. Update deep prompts
- ask the agent to assess navigability, structure, enforcement, and validation readiness directly

2. Separate deep findings into two classes
- score-upgrading findings
- descriptive harness findings

3. Update report copy
- add a dedicated deep section focused on harness quality
- keep existing score summary intact

### Out of scope

- no major score recomputation
- no automatic maturity score

### Validation

- tests showing heuristic pass results are never downgraded
- tests showing descriptive deep findings do not mutate stable score behavior unless explicitly mapped

### Exit criteria

- deep mode gives a meaningful repo-level harness assessment
- deep findings are richer without destabilizing core scoring

## Phase 4 — Corpus Validation And Calibration

### Scope

Run the updated audit against a small set of real repos before changing weights or adding more checks.

### What to do

1. Select a validation corpus
- minimal repo
- medium-quality app repo
- strong agent-ready repo
- monorepo-like repo
- docs-heavy but weak-tooling repo

2. Record outcomes
- which checks almost always fail
- which checks almost always pass
- which checks correlate with useful findings

3. Remove or rewrite weak checks
- drop low-signal or noisy detections
- tighten detection rules where needed

### Out of scope

- no productized telemetry
- no hosted benchmarking

### Exit criteria

- each new check has acceptable signal quality
- obvious noisy checks are removed before broader rollout

## Phase 5 — Optional Scoring Rebalance

### Scope

Only after corpus validation, consider shifting scoring toward harness quality.

### What to implement

1. Review category weights
- consider increasing emphasis on feedback loops, docs structure, and mechanical enforcement

2. Re-rank blockers and fix plan logic if needed
- ensure top blockers reflect actual agent failure modes

3. Version scoring changes clearly
- preserve comparability by documenting rubric changes

### Out of scope

- no unvalidated scoring changes

### Exit criteria

- rebalanced scoring has been tested on the validation corpus
- new scores are defensible and easier to explain than the old ones

## Recommended Order

Implement in this order:
1. Phase 1
2. Phase 1.5
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5

## Recommended First Deliverable

Ship Phases 1 and 1.5 together before starting Phase 2.

Why:
- adds the highest-signal regular checks
- hardens those checks against real-project false negatives/noise
- stabilizes JSON failure behavior for automated consumers
- avoids premature scoring churn
- keeps implementation risk contained
