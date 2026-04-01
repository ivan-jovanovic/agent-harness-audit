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

1. [x] Add deterministic excerpt collection
- root file tree summary
- `AGENTS.md` or `CLAUDE.md`
- docs index or top-level docs listing
- package scripts summary
- workflow names
- selected architecture/reliability docs when present

2. [x] Update deep prompt construction in `src/agents/`
- pass excerpts alongside heuristic evidence
- keep prompt size capped and deterministic

3. [x] Extend deep result types
- add `strengths`
- add `risks`
- add `autonomyBlockers`

4. [x] Update deep report rendering
- show these fields in text mode
- include them in JSON mode

### Implementation contract

1. Excerpt collection rules (deterministic)
- fixed section order in prompt payload:
  1) repo summary
  2) primary instructions excerpt
  3) docs entrypoint excerpt
  4) package scripts summary
  5) CI/workflow summary
  6) architecture/reliability excerpts
- stable truncation limits per section (character or line based)
- same input repo state must produce byte-stable excerpt output

2. Deep adapter result contract
- `findings` remains mandatory for score-upgrading checks
- add optional descriptive arrays:
  - `strengths: string[]`
  - `risks: string[]`
  - `autonomyBlockers: string[]`
- parser must tolerate:
  - envelope wrappers
  - arrays/object payload roots
  - missing optional fields

3. Merge behavior
- only allow deep findings to upgrade checks (`false -> true`)
- never downgrade heuristic pass states
- keep deep descriptive fields separate from scoring mutation

### File-level task map

1. Deep prompt and parsing
- `src/agents/claude-code.ts`
- `src/agents/codex.ts`
- `src/agents/parsing.ts`
- `src/agents/checks.ts`

2. Shared types and merge plumbing
- `src/types.ts`
- `src/commands/audit.ts`

3. Rendering and JSON output
- `src/reporters/text.ts`
- `src/reporters/json.ts`

4. Tests
- `tests/agents/claude-code.test.ts`
- `tests/agents/codex.test.ts`
- `tests/agents/index.test.ts`
- `tests/commands/audit.deep.test.ts`
- `tests/cli.test.ts`

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

- [x] deep mode includes targeted excerpts
- [x] deep mode returns `strengths`, `risks`, and `autonomyBlockers`
- [x] text and JSON reports render the richer deep result cleanly

## Phase 2.5 — Levels And Dynamic Reporting

### Scope

Add a maturity-layered reporting experience to reduce overwhelm on weak repos while keeping current scoring canonical.

### Level-to-check mapping (V1)

Use the following hard-gate sets for level determination. Soft signals are shown as staged recommendations (`Next` / `Later`) and do not block level progression in V1.

1. Level 1 — `Bootstrap` hard gates
- `has_package_json`
- `has_lockfile`
- `has_primary_instructions`
- `has_readme`
- `has_test_script`
- `has_local_dev_boot_path`

2. Level 2 — `Baseline` hard gates
- `has_test_dir`
- `has_test_files`
- `has_lint_script`
- `has_typecheck_script`
- `has_build_script`
- `has_env_example`
- `has_docs_index`

3. Level 3 — `Reliable` hard gates
- `has_architecture_docs`
- `has_structured_docs`
- `has_ci_validation`
- `has_e2e_or_smoke_tests`
- `has_architecture_lints`
- `has_execution_plans`

4. Level 4 — `Autonomous-Ready` additional hard gates
- all Level 1–3 hard gates pass
- `has_short_navigational_instructions`
- `has_observability_signals`
- `has_quality_or_debt_tracking`

Level precedence:
- if any Level 1 gate fails -> Level 1
- else if any Level 2 gate fails -> Level 2
- else if any Level 3 gate fails -> Level 3
- else if any Level 4 additional gate fails -> Level 3 (upper-reliable, not autonomous-ready)
- else -> Level 4

### What to implement

1. Add level determination from scored + level-only check IDs
- implement a deterministic level calculator in `src/scoring/` (or `src/reporters/` if kept presentation-only):
  - Level 1: `Bootstrap`
  - Level 2: `Baseline`
  - Level 3: `Reliable`
  - Level 4: `Autonomous-Ready`
- derive levels from hard-gate check groups only (no new scoring math)
- level-only checks are new, additive IDs for this phase and must not rename, replace, or alias existing scored check IDs

2. Add staged recommendation rendering
- update text report to present recommendations by current maturity:
  - `Now` (current-level hard gates)
  - `Next`
  - `Later`
- cap default recommendation volume for low-maturity repos

3. Keep score and JSON compatibility stable
- preserve `overallScore`, category scores, blocker ranking, and fix plan behavior
- include level metadata as additive output only
- do not add new scored checks in this phase
- `report.level` may affect staged recommendation copy/order, but it must not change canonical score math or existing top-level JSON fields consumed by current callers

4. Keep deep integration lightweight
- deep findings can improve evidence and prioritization
- do not expand blocker surface by level in V1
- do not require deep adapters/prompts to become level-aware

### Implementation contract

1. Scoring isolation (non-negotiable)
- Phase 2.5 must not modify:
  - category weights
  - check weights
  - pass/fail formulas for existing scored checks
- new checks introduced for Level 3/4 (`has_execution_plans`, `has_short_navigational_instructions`, `has_observability_signals`, `has_quality_or_debt_tracking`) are level-only checks in this phase
- level-only checks must not be added to scored category check arrays until a later scoring phase

2. Level model types (additive only)
- add exact level fields at top-level report path: `report.level`
- required fields:
  - `report.level.id` (`1 | 2 | 3 | 4`)
  - `report.level.label` (`Bootstrap | Baseline | Reliable | Autonomous-Ready`)
  - `report.level.blockingGateSet` (`level1 | level2 | level3 | level4_additional`)
  - `report.level.failedHardGates` (`string[]`, check IDs)
  - `report.level.stagedFixes.now` (`string[]`, check IDs)
  - `report.level.stagedFixes.next` (`string[]`, check IDs)
  - `report.level.stagedFixes.later` (`string[]`, check IDs)
- optional fields:
  - `report.level.nextLevelId` (`2 | 3 | 4`)
- keep existing `scoring` object canonical for all existing consumers

3. Level calculation source of truth
- derive a normalized gate table from:
  - scored checks in `scoring.categoryScores[].checks`
  - level-only checks from deterministic evidence collectors
- do not duplicate check-pass logic in reporter
- level calculator must be deterministic and pure
- normalization rule for duplicate check IDs in scored categories:
  - collapse by `checkId`
  - `passed` = logical OR across occurrences
  - canonical metadata source = first occurrence by stable category order:
    `instructions -> context -> tooling -> feedback -> safety`

4. Staged recommendation algorithm
- build a checkId -> `FixItem` map from prioritized `fixPlan`
- for any staged bucket, checks with a `FixItem` keep fix-plan priority order and tie-break by lexical `checkId` ascending; checks without a `FixItem` are appended after all fix-plan-backed items in lexical `checkId` ascending order
- `Now`:
  - failed hard gates for `blockingGateSet` only
  - preserve existing fix-plan priority order
  - tie-break when priority is equal: lexical `checkId` ascending
  - cap:
    - Level 1: max 3
    - Level 2+: max 4
  - text output may cap with `+N more`; JSON `stagedFixes.now` must include all check IDs (no truncation)
- `Next`:
  - failed hard gates in the immediate next level (priority order, same tie-break)
  - then highest-priority failed soft signals
  - cap max 4
  - when next-level hard gates exceed cap, include only hard gates (no soft-signal spillover)
- `Later`:
  - remaining failed soft signals/checks
- `--json` always includes full fix plan; staged buckets are additive metadata
- Level 3 upper-reliable case (all Level 1-3 pass, Level 4 additional fail):
  - set `blockingGateSet = level4_additional`
  - populate `Now` from failed Level 4 additional gates

5. Deep-mode interaction rules
- deep evidence can change which checks are passed, and therefore resulting level
- deep descriptive findings (`strengths/risks/autonomyBlockers`) do not create new hard gates in this phase
- reporter can use deep evidence text to explain staged items, but gate membership is check-ID driven

### Initial heuristic definitions for new level-driving checks

These definitions are implementation starting points and are expected to be calibrated in Phase 4.

1. `has_execution_plans`
- pass if any of the following exists:
  - root file matching (case-insensitive):
    - `implementation-plan*.md`
    - `execution-plan*.md`
    - `roadmap*.md`
    - `mvp-plan*.md`
    - `product-roadmap*.md`
  - at least one markdown file under:
    - `plans/`
    - `docs/plans/`

2. `has_short_navigational_instructions`
- choose primary instruction file by precedence:
  - `AGENTS.md` if present, else `CLAUDE.md`
- pass iff all are true:
  - selected file exists
  - line count <= 250
  - contains at least 2 markdown links to local docs/files:
    - regex: `\\[[^\\]]+\\]\\((?!https?://)[^)]+\\)`

3. `has_observability_signals`
- pass if at least one condition is true:
  - dependency/devDependency key in any discovered package manifest equals one of:
    - `pino`
    - `winston`
    - `@opentelemetry/api`
    - `@opentelemetry/sdk-node`
    - `@sentry/node`
    - `@sentry/browser`
    - `@sentry/nextjs`
    - `dd-trace`
    - `newrelic`
    - `prom-client`
  - root file exists with one of these names:
    - `instrumentation.ts`
    - `instrumentation.js`
    - `telemetry.ts`
    - `telemetry.js`
    - `observability.ts`
    - `observability.js`

4. `has_quality_or_debt_tracking`
- pass if any is true:
  - root file exists (case-insensitive):
    - `TECH_DEBT.md`
    - `DEBT.md`
    - `QUALITY.md`
    - `BACKLOG.md`
    - `TODO.md`
  - at least one markdown file exists under:
    - `docs/debt/`
    - `docs/quality/`
    - `docs/maintenance/`

### File-level task map

1. Types and scoring metadata
- `src/types.ts`
- `src/scoring/index.ts`
- `src/scoring/levels.ts`

2. Level-only signal detection (non-scored in this phase)
- `src/inspection/local.ts`
- `src/inspection/package.ts`

3. Reporting
- `src/reporters/text.ts`
- `src/reporters/json.ts`

4. Tests and fixtures
- `tests/scoring/scoring.test.ts`
- add scoring snapshot/regression tests proving Phase 2.5 does not change canonical scores for existing fixtures
- `tests/inspection/local.test.ts`
- `tests/inspection/package.test.ts`
- `tests/commands/audit.deep.test.ts`
- `tests/cli.test.ts`
- add/update fixtures under `fixtures/` to represent each level transition

### Out of scope

- no scoring weight rebalance
- no replacement of the existing 0–100 scoring system
- no 1–9 maturity scale in this phase

### Validation

- tests for deterministic level assignment from check outcomes
- reporter tests for staged output at each level
- regression tests proving canonical scoring output remains unchanged
- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run build`

### Exit criteria

- [x] level assignment is deterministic and test-covered
- [x] low-maturity repos receive shorter, staged recommendations by default
- [x] canonical scoring remains backward-compatible

### Verification notes

- [x] `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal` completed successfully (exit 0).
- [x] `node dist/cli.js audit /Users/ivan.jovanovikj/Documents/Helloprint/portal --deep --agent claude-code --json` completed successfully (exit 0) and returned a JSON report with `level` and `deepAudit` fields.

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

### Implementation contract

1. Deep finding classes
- keep score-upgrading findings separate from descriptive harness findings
- descriptive findings can influence ordering/copy, not score mutation (unless explicitly mapped)

2. Prompt contract
- prompts must request:
  - navigability assessment
  - boundary/enforcement assessment
  - validation-loop assessment
  - autonomy blockers with concrete repo evidence
- require concise, evidence-grounded statements (no generic advice text)

3. Output contract
- text report deep section order:
  1) strengths
  2) risks
  3) autonomy blockers
- JSON output keeps these as structured arrays in `deepAudit`

### File-level task map

1. Prompt and adapter behavior
- `src/agents/claude-code.ts`
- `src/agents/codex.ts`
- `src/agents/checks.ts`
- `src/agents/parsing.ts`

2. Merge/orchestration
- `src/commands/audit.ts`
- `src/types.ts`

3. Reporting
- `src/reporters/text.ts`
- `src/reporters/json.ts`

4. Tests
- `tests/agents/claude-code.test.ts`
- `tests/agents/codex.test.ts`
- `tests/commands/audit.deep.test.ts`
- `tests/cli.test.ts`

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
4. Phase 2.5
5. Phase 3
6. Phase 4
7. Phase 5

## Recommended First Deliverable

Ship Phases 1 and 1.5 together before starting Phase 2.

Why:
- adds the highest-signal regular checks
- hardens those checks against real-project false negatives/noise
- stabilizes JSON failure behavior for automated consumers
- avoids premature scoring churn
- keeps implementation risk contained

## Implementation handoff rules

Use this section as non-negotiable implementation guidance for execution agents:

1. Preserve backward compatibility
- do not remove or rename existing top-level JSON report fields
- any new fields are additive

2. Keep scoring canonical
- no hidden weight shifts outside Phase 5
- levels are derived overlays in Phase 2.5

3. Keep deep behavior bounded
- deep can enrich evidence and prioritization
- deep cannot downgrade passed heuristic checks

4. Testing gate for each phase
- phase is not complete until all validation commands pass:
  - `npm run lint`
  - `npm run typecheck`
  - `npm test`
  - `npm run build`
