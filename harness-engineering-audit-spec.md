# Harness Engineering Audit Update

Date: 2026-03-26
Status: Proposal

## Proposed Regular Audit Updates

### 1. `has_docs_index`

Why:

- distinguishes a real repo knowledge base from a random pile of docs
What we audit:
- whether the repo has an obvious docs entrypoint such as `docs/index.md`, `docs/README.md`, or a similar top-level index file

### 2. `has_structured_docs`

Why:

- rewards repos that keep architecture, product, and reference docs in discoverable sections
What we audit:
- whether `docs/` contains meaningful sub-structure such as architecture, design, product, reference, or plans-oriented sections instead of a flat dump of markdown files

### 3. `has_local_dev_boot_path`

Why:

- agents need a clear way to start the app locally
What we audit:
- whether the repo exposes a recognizable local run path through scripts like `dev`, `start`, `preview`, `serve`, or similar boot commands

### 4. `has_ci_validation`

Why:

- CI is a strong signal that validation is standardized and repeatable
What we audit:
- whether CI workflows exist and appear to run validation steps such as build, lint, test, typecheck, or verify commands

### 5. `has_e2e_or_smoke_tests`

Why:

- better proxy for "can the agent verify behavior" than unit tests alone
What we audit:
- whether the repo contains signals for lightweight end-to-end or smoke validation such as Playwright, Cypress, webdriver, or dedicated smoke-test scripts

### 6. `has_architecture_lints`

Why:

- checks whether repo boundaries are enforced mechanically, not just described in docs
What we audit:
- whether the repo includes signals for mechanical boundary enforcement such as dependency-cruiser, eslint boundary rules, structural tests, import-layer checks, or architecture validation scripts

### 7. `has_observability_signals`

Why:

- logs, metrics, and traces make runtime behavior more legible to agents
What we audit:
- whether the repo exposes logging, tracing, metrics, or observability tooling signals that suggest runtime behavior is inspectable

### 8. `has_execution_plans`

Why:

- plans in-repo help agents work on larger tasks without relying on external context
What we audit:
- whether the repo stores plans, execution notes, or tracked implementation plans in-repo under recognizable files or directories

### 9. `has_short_navigational_instructions`

Why:

- a short `AGENTS.md` or `CLAUDE.md` that points elsewhere is more useful than a large stale manual
What we audit:
- whether the primary instruction file is concise and link-heavy, acting as a map to deeper sources instead of trying to hold all project knowledge directly

### 10. `has_quality_or_debt_tracking`

Why:

- shows the repo has some ongoing mechanism for preventing drift
What we audit:
- whether the repo includes visible tracking for quality gaps, technical debt, cleanup work, or recurring maintenance

## Proposed Deep Audit Updates

### 1. Pass targeted file excerpts, not just booleans

Include:

- `AGENTS.md` or `CLAUDE.md`
- docs index
- package scripts summary
- workflow names
- selected architecture or reliability docs when present

Why:

- deep audit is too blind today and needs actual repo context
What we audit:
- whether the selected excerpts give the agent enough grounded context to judge repo navigability, structure, and validation readiness

### 2. Add richer deep output

Add:

- `strengths`
- `risks`
- `autonomyBlockers`

Why:

- deep mode should explain harness quality, not just flip checks
What we audit:
- what the agent identifies as the repo's strongest harness traits, main operational risks, and the specific blockers that would stop autonomous work

### 3. Make deep mode assess harness quality directly

Why:

- agents are better at judging whether a repo is navigable, enforceable, and workable than at acting as a narrow boolean checker only
What we audit:
- whether the repo is understandable, constrained, and verifiable enough for an agent to work productively without constant human steering

### 4. Keep deep score upgrades limited

Why:

- deep mode should enrich the report without making scoring unstable or overly subjective
What we audit:
- which deep findings are strong enough to upgrade existing checks and which should remain descriptive findings only

## Not Doing Yet

### 1. No major scoring rebalance yet

Why:

- new checks should be tested on real repos first

### 2. No large set of niche filename-based checks

Why:

- they are too noisy and too low-signalgit 

### 3. No maturity taxonomy yet

Why:

- labels like `foundational` or `autonomous` are not calibrated yet

## Recommended First Batch

Implement first:

- `has_docs_index`
- `has_structured_docs`
- `has_local_dev_boot_path`
- `has_ci_validation`
- `has_e2e_or_smoke_tests`
- `has_architecture_lints`
- deep excerpts
- deep `strengths`
- deep `risks`
- deep `autonomyBlockers`

Why:

- this is the smallest set of changes that moves the audit toward harness quality without overengineering it

