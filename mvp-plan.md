# Agent Harness Audit CLI MVP Plan

Updated: 2026-03-18

## Purpose
Define the smallest useful version of `Agent Harness Audit CLI` as an independent product and codebase.

This project is a CLI-native fork of the `Agent Harness` idea, not a shared implementation with the web app. It should be designed for local project audits, terminal-first workflows, and independent iteration.

## Product Direction

### Working product name
- `agent-harness`

### Product summary
- A local-first CLI that audits a software project for agent-readiness before the user gives Claude Code, Cursor, or other coding agents broad autonomy.

### Core job to be done
- "Before I let an AI coding agent make more changes in this repo, tell me what is missing in my project setup and what I should fix first."

### Primary user
- Semi-technical solo builders working in existing web app repos
- Current tools: Claude Code, Cursor, or similar AI coding tools
- Current pain: regressions, context drift, unclear instructions, weak validation loops

### Initial wedge
- Audit local project directories for agent-readiness
- Return a score, top blockers, and recommended fixes
- Optionally generate starter files the user can adapt

## MVP Promise
- "Run one command in your repo and get an Agent Harness Score, the top setup issues hurting agent performance, and the fastest fixes."

## Scope

### In
- Local filesystem audit of a project directory
- Heuristic scoring across five categories:
  - Instructions
  - Context
  - Tooling
  - Feedback
  - Safety Gates
- Human-readable terminal report
- Machine-readable JSON output
- Optional generation of starter artifacts into the repo
- Initial focus on JavaScript/TypeScript web app repos

### Out
- Hosted UI
- Database or user accounts
- GitHub API integration in V1
- Private remote repo syncing
- IDE plugin support
- Automatic PR creation
- Continuous background monitoring
- Deep code quality or security review

## MVP Command Surface

### Primary command
```bash
agent-harness audit .
```

### Required supported variants
```bash
agent-harness audit /path/to/repo
agent-harness audit . --tool claude-code
agent-harness audit . --tool cursor
agent-harness audit . --failure-mode "regressions after edits"
agent-harness audit . --safety-level high
agent-harness audit . --json
agent-harness audit . --write-artifacts
agent-harness audit . --output audit-report.json --json
```

### Nice-to-have but not required for first release
- `agent-harness explain`
- `agent-harness init`
- `agent-harness doctor`
- `agent-harness compare`

## MVP Inputs

### Required
- repo path

### Optional
- agent tool used
- primary failure mode
- safety level

### Defaults
- path: current working directory
- tool: `other`
- safety level: `medium`
- failure mode: empty

## MVP Output

### 1. Score summary
- overall score out of 100
- five category scores out of 5

### 2. Top blockers
- top 3 missing or weak signals
- why each matters
- likely failure mode

### 3. Fix plan
- prioritized remediation list
- estimated effort:
  - quick
  - medium
  - heavy

### 4. Optional generated artifacts
- `AGENTS.generated.md`
- `validation-checklist.generated.md`
- `architecture-outline.generated.md`

Generated artifacts must never overwrite existing files by default.

## Audit Rubric

### Instructions
What good looks like:
- repo-specific instructions exist
- agent constraints and operating rules are explicit
- README or equivalent setup guidance exists

Common failure mode:
- agent makes wrong assumptions or edits too broadly

### Context
What good looks like:
- repo structure is discoverable
- docs or notes provide architecture clues
- language/runtime is obvious

Common failure mode:
- agent thrashes because it cannot build a stable mental model of the codebase

### Tooling
What good looks like:
- package manifest exists
- lockfile exists
- validation scripts are present and discoverable

Common failure mode:
- agent cannot run or verify work consistently

### Feedback
What good looks like:
- tests exist
- lint/typecheck/test feedback loop is available
- CI or equivalent validation exists

Common failure mode:
- bad changes slip through and compound over time

### Safety Gates
What good looks like:
- environment requirements are documented
- execution/review expectations are clear
- there is a visible validation path before merge

Common failure mode:
- agent executes too early and damages working code

## V1 Heuristic Checks

### Files and docs
- `AGENTS.md`
- `CLAUDE.md`
- `README.md`
- `docs/`
- `.env.example`
- `CONTRIBUTING.md`
- architecture notes such as `ARCHITECTURE.md` or `docs/architecture.md`

### Package/tooling
- `package.json`
- lockfile:
  - `package-lock.json`
  - `pnpm-lock.yaml`
  - `yarn.lock`
- scripts:
  - `lint`
  - `typecheck`
  - `test`
  - `build`

### Feedback and validation
- `tests/`, `test/`, or `__tests__/`
- root `*.test.*` or `*.spec.*` files
- `.github/workflows/*.yml`
- common config hints:
  - `vitest.config.*`
  - `jest.config.*`
  - `playwright.config.*`
  - `eslint` config
  - `tsconfig.json`

### Safety/context clues
- env documentation
- contribution docs
- architecture docs
- validation commands mentioned in docs

## Technical Direction

### Recommended stack
- Language: TypeScript
- Runtime: Node.js 20+
- Packaging: npm package with executable bin entry
- CLI parsing: lightweight library or minimal hand-rolled parser
- Output formatting: terminal text + JSON serializer
- Tests: Vitest

### Why TypeScript
- Faster to port the current scoring concepts
- Strong fit for JS/TS repo inspection
- Easy npm distribution for the target audience

## Architecture

### Proposed structure
- `src/cli.ts`
  - CLI entrypoint
- `src/commands/audit.ts`
  - command orchestration
- `src/inspection/local.ts`
  - local filesystem evidence collection
- `src/inspection/package.ts`
  - package manifest and scripts parsing
- `src/scoring/index.ts`
  - rubric scoring
- `src/artifacts/generate.ts`
  - starter artifact generation
- `src/reporters/text.ts`
  - terminal report output
- `src/reporters/json.ts`
  - structured output
- `src/types.ts`
  - shared types
- `tests/`
  - unit tests and fixture-based audits
- `fixtures/`
  - example repos/snapshots for scoring tests

### Execution flow
1. Resolve target path
2. Validate path is a repo-like project directory
3. Collect evidence from local files
4. Score the project against the rubric
5. Render report
6. Optionally write generated artifacts

## Data Model

### `AuditInput`
- `path`
- `tool`
- `failureMode`
- `safetyLevel`

### `RepoEvidence`
- detected top-level files
- docs signals
- package signals
- test signals
- workflow signals
- language/runtime hints

### `ScoringResult`
- `overallScore`
- `categoryScores`
- `topBlockers`

### `AuditReport`
- input summary
- evidence summary
- scoring result
- recommended fixes
- generated artifact previews or paths

## UX Principles
- Terminal-first and fast
- Output should feel concrete, not generic
- Explanations must cite detected evidence, not black-box reasoning
- Default mode should be read-only
- Write actions must be explicit
- Errors must tell the user exactly what is missing or unsupported

## Safety Rules
- Never overwrite existing `AGENTS.md`, `CLAUDE.md`, or docs files by default
- Generated files should use `.generated.md` suffix in V1
- CLI should exit non-zero on unsupported paths or invalid flags
- Local audit should work without network access

## MVP Milestones

### Task 1: Lock product and technical constraints
- Status: `todo`
- Goal: freeze the first CLI scope so implementation stays narrow
- Acceptance criteria:
  - target user is explicit
  - JS/TS web app repos are the only supported segment in V1
  - no hosted/web concerns leak into CLI architecture

### Task 2: Scaffold CLI project
- Status: `todo`
- Goal: create the baseline package structure and runnable command
- Scope:
  - initialize Node + TypeScript project
  - add executable bin entry
  - add test harness
- Acceptance criteria:
  - `agent-harness --help` works
  - `agent-harness audit .` runs a stub command

### Task 3: Implement local repo inspection
- Status: `todo`
- Goal: collect deterministic evidence from local files
- Scope:
  - detect core files and directories
  - parse `package.json`
  - detect lockfiles, test dirs, workflows, docs
- Acceptance criteria:
  - evidence collection works on sample fixture repos
  - unsupported/missing-path cases fail clearly

### Task 4: Implement scoring engine
- Status: `todo`
- Goal: convert evidence into explainable rubric scores
- Scope:
  - score five categories
  - compute overall score
  - generate top blockers
- Acceptance criteria:
  - scoring is deterministic
  - each low score can be explained from evidence

### Task 5: Implement terminal reporter
- Status: `todo`
- Goal: make the audit understandable in one screen
- Scope:
  - overall score
  - category scores
  - blockers
  - fix plan
- Acceptance criteria:
  - report is readable in a normal terminal width
  - no black-box-only output

### Task 6: Add JSON output
- Status: `todo`
- Goal: support automation and CI usage
- Scope:
  - `--json`
  - optional file output path
- Acceptance criteria:
  - output schema is stable and documented
  - report can be consumed by scripts

### Task 7: Add starter artifact generation
- Status: `todo`
- Goal: make the CLI useful beyond diagnosis
- Scope:
  - generate starter files from templates
  - write only on explicit flag
- Acceptance criteria:
  - files are created with `.generated.md` suffix
  - generation never overwrites user files by default

### Task 8: Add quality gates and packaging
- Status: `todo`
- Goal: make the tool installable and trustworthy
- Scope:
  - lint
  - typecheck
  - tests
  - package metadata
  - usage docs
- Acceptance criteria:
  - clean local verification path exists
  - package can be installed and run locally

## Recommended Build Order
1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6
7. Task 7
8. Task 8

## Success Criteria
- A user can run the CLI in a local repo and get a useful result in under 10 seconds for normal projects
- The output surfaces at least one issue the user recognizes as real
- The fix plan feels actionable rather than generic
- The tool is useful without any hosted component

## Biggest Risks
- The audit feels like a shallow checklist
- Local heuristics miss important context in unusual repos
- Supporting too many stacks too early makes the rubric noisy
- Generated artifacts become generic filler instead of useful starting points

## Risk Reduction Strategy
- Start with JS/TS web app repos only
- Keep the rubric transparent
- Test the CLI on real repos early
- Prefer fewer checks with stronger explanations over broad but weak scanning

## Immediate Next Step
- Initialize the separate CLI repo and implement `agent-harness audit .` with local filesystem inspection only.
