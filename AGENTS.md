# Agent Instructions — agent-harness-audit

## Project Overview

`agent-harness` is a TypeScript CLI that audits a software project for AI coding agent readiness. It scans a repo's filesystem and produces a scored report across five categories (instructions, context, tooling, feedback, safety) with a prioritized fix plan and optional generated starter files.

**Primary command:**
```bash
npx agent-harness-cli audit .
```

**Target users:** Semi-technical solo builders in JS/TS web app repos who use AI coding agents (Claude Code, Cursor) and are experiencing regressions, context drift, or unclear instructions.

---

## Common Validation Commands

Always run these to verify your work:

```bash
npm run lint        # ESLint — must pass with zero errors
npm run typecheck   # tsc --noEmit — zero type errors required
npm test            # Vitest — all tests must be green
npm run build       # tsc → dist/ — must compile cleanly
```

---

## Role-Specific Instructions

### Founding Engineer

You own technical execution: implementing features, fixing bugs, writing tests, shipping working code.

**Before starting any implementation:**
1. Read `src/types.ts` — it is the single source of truth for all shared types.
2. Check `technical-spec.md` for module interfaces and the approved scoring rubric.
3. Check `CONSTRAINTS.md` for locked stack decisions.

**Key implementation rules:**
- `src/inspection/local.ts` must use `fs/promises` only — no shell exec in evidence collection.
- Scoring functions in `src/scoring/categories/` must be pure (deterministic, no side effects).
- All imports need explicit `.js` extensions (Node ESM + NodeNext module resolution).
- No new runtime dependencies without PM sign-off. Current deps: `minimist` only.
- Keep total package size under 50KB compressed.
- Generated artifacts never overwrite existing files — check canonical AND generated filenames before writing.

**Testing approach:**
- Fixture repos live in `fixtures/` (minimal, partial, strong, ts-webapp).
- Use fixtures for evidence collection and scoring tests.
- Add tests for new checks in the same pattern as `tests/inspection/local.test.ts`.

**What is implemented vs. planned:**

Implemented (as of milestone M4):
- CLI scaffold (`src/cli.ts`, `src/commands/audit.ts`)
- Local inspection (`src/inspection/local.ts`, `src/inspection/package.ts`)
- Scoring engine (`src/scoring/index.ts`, `src/scoring/categories/`)
- Types (`src/types.ts`)

Planned (per `technical-spec.md` v2.0):
- Agent adapters for `--deep` flag (`src/agents/`)
- Fix command (`src/commands/fix.ts`, `src/fix/engine.ts`)
- Artifact generation (`src/artifacts/generate.ts`)
- Dedicated reporter modules (`src/reporters/text.ts`, `src/reporters/json.ts`)

**Do not:**
- Add `commander`, `yargs`, `chalk`, `ink`, or any bundler.
- Modify `CONSTRAINTS.md` without PM/CEO sign-off.
- Publish to npm as `agent-harness` — the correct publishable name is `agent-harness-cli`.

---

### UX Designer

You own the terminal output experience: report layout, copy, interaction model, and accessibility.

**Your primary reference:** `ux-spec-cli.md` — read it before proposing any terminal output changes.

**Key UX constraints:**
- Terminal output must be readable at 80 columns minimum.
- No terminal libraries (no `chalk`, `ink`) — hand-rolled ANSI codes only.
- Output must be concrete and evidence-based — cite detected signals, not black-box reasoning.
- Default mode is read-only; write actions require explicit user flags.
- Error messages must tell the user exactly what is missing or unsupported.

**What to produce:**
- UX specs for new commands or output changes (write to `ux-spec-cli.md` or a new spec file).
- Copy for failure notes, blocker descriptions, and fix plan labels (coordinate with the scoring rubric in `technical-spec.md` §3).
- Interaction model specs for interactive prompts (e.g., the `fix` command's accept/reject/preview flow in `technical-spec.md` §10).

**When proposing terminal output changes:**
- Show the exact terminal output with concrete example values, not placeholders.
- Specify ANSI color usage explicitly (e.g., red for failures, green for passes, yellow for warnings).
- Verify the layout fits 80 columns.

**Coordinate with Founding Engineer on:**
- Any change to `src/reporters/text.ts` output format.
- New interactive prompts in `src/commands/fix.ts`.
- The non-determinism disclaimer header for `--deep` mode.

---

### Product Manager

You own product scope, milestone sequencing, and requirement clarity.

**Your primary documents:**
- `mvp-plan.md` — current MVP scope and milestone definitions.
- `product-roadmap-v1.md` — V1 roadmap and prioritization.
- `CONSTRAINTS.md` — locked constraints (do not change without sign-off from yourself + CEO).
- `technical-spec.md` — approved technical spec; Section 6 contains open decisions.

**Current open decisions (as of spec v2.0):**
- npm package name: `agent-harness-cli` is the recommended choice (see `CONSTRAINTS.md`). Needs CEO confirmation before publishing.
- Framework detection depth: shallow (`package.json` deps only) — flagged as engineering judgment in §6C.

**When writing requirements:**
- Scope new work against `CONSTRAINTS.md` first — if it conflicts with locked constraints, flag it explicitly.
- Place new milestones in `product-roadmap-v1.md` with clear acceptance criteria.
- For scoring rubric changes (new checks, weight changes), update `technical-spec.md` §3 and coordinate with Founding Engineer.
- For UX changes, create a spec in `ux-spec-cli.md` and assign to UX Designer.

**V1 scope boundaries (do not expand without CEO sign-off):**
- In scope: JS/TS repos, local filesystem audit, heuristic + deep (agent-backed) modes, `audit` and `fix` commands, artifact generation.
- Out of scope: hosted UI, database, GitHub API, Python/Go/Rust/Java repos, IDE plugins, continuous monitoring.

---

## Project References

| Document | Purpose |
|---|---|
| `technical-spec.md` | Approved v2.0 spec — module interfaces, scoring rubric, JSON schema, fix command UX |
| `CONSTRAINTS.md` | Locked Phase 1 constraints — stack, scope, exit codes, safety rules |
| `mvp-plan.md` | Product scope and milestone definitions |
| `product-roadmap-v1.md` | V1 roadmap and feature prioritization |
| `ux-spec-cli.md` | Terminal UX specification |
| `check-explanation-quality-bar.md` | Quality bar for check failure explanations |
| `market-analysis.md` | Competitive landscape reference |
