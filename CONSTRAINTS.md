# Agent Harness CLI — Phase 1 Constraints

_Locked: 2026-03-20. Do not change without PM/CEO sign-off._

---

## npm Package Name

**Status: `agent-harness` is taken on npm.**

`npm info agent-harness` returns an existing package (v0.0.1, published 7 months ago by a third party). We cannot use this name.

### Recommended alternative: `agent-harness-cli`

- Available on npm (confirmed 2026-03-20)
- Follows the standard `-cli` suffix convention for CLI tools
- The executable bin name remains `agent-harness`, so the end-user command is unchanged:
  ```bash
  npx agent-harness-cli audit .
  # or after global install:
  agent-harness audit .
  ```

### Other available names (if CEO/PM prefers a different choice)

| Name              | Status    |
|-------------------|-----------|
| `agent-harness-cli` | Available |
| `agentharness`    | Available |
| `harness-audit`   | Available |
| `agent-audit`     | Available |
| `ai-agent-harness`| Available |
| `repo-harness`    | Available |

**Action required:** CEO/PM must confirm the package name before M2 scaffold begins. Once confirmed, reserve it with a `0.0.1` placeholder publish.

---

## Target User

Semi-technical solo builders working in existing JS/TS web app repos who use AI coding agents (Claude Code, Cursor, or similar) and are experiencing:
- Regressions after agent edits
- Context drift
- Unclear instructions
- Weak validation loops

---

## Supported Scope — V1

- **In:** JavaScript and TypeScript web app repos, local filesystem audit only
- **Out:** Python, Go, Rust, Java, or other language ecosystems (V1)
- **Out:** Hosted UI, database, user accounts, GitHub API integration
- **Out:** IDE plugins, automatic PR creation, continuous background monitoring
- **Out:** Deep code quality or security review

---

## Stack — Locked

| Concern        | Decision                     | Notes |
|----------------|------------------------------|-------|
| Language       | TypeScript                   | Type safety for scoring engine; target audience is JS/TS devs |
| Runtime        | Node.js 20+ (LTS)            | `engines: { "node": ">=20" }` in package.json |
| CLI parsing    | `minimist` (or hand-rolled)  | No `commander` or `yargs` — dep weight too high for 3 flags |
| Terminal output | Hand-rolled ANSI             | No `chalk` or `ink` in V1 |
| Test runner    | Vitest                       | Fast, native TypeScript |
| Build          | `tsc` only → `dist/`         | No bundler in V1 |
| Packaging      | npm bin entry                | `npx agent-harness-cli audit .` is the zero-install path |

---

## Architecture Constraints

- CLI must work fully offline (no network required for heuristic audit)
- Default mode is read-only; write actions require explicit `--write-artifacts` flag
- Generated files use `.generated.md` suffix and never overwrite existing files
- Exit codes: 0 = success, 1 = usage/flag error, 2 = path error (see tech-spec §2.3)
- JSON output schema must be stable and documented before 1.0
- Total package size target: under 50KB compressed (enforced in CI)

---

## What This Document Is Not

This file locks the Phase 1 build constraints. For full product scope see `mvp-plan.md`, for module interfaces and type definitions see `technical-spec.md`, and for milestone sequencing see `product-roadmap-v1.md`.
