# Harness Engineering Audit Update — Implementation Plan

Date: 2026-03-26
Status: Proposal

## Goal

Implement the harness-engineering audit update in small phases, starting with the highest-signal additions and avoiding scoring churn or overly noisy heuristics.

## Phase 1 — High-Signal Heuristic Checks

### Completed

- [x] `has_docs_index`

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
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

## Recommended First Deliverable

Ship Phases 1 and 2 together as the first practical update.

Why:
- adds the highest-signal regular checks
- makes deep mode materially more useful
- avoids premature scoring churn
- keeps implementation risk contained
