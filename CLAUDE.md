# agent-harness-audit — Claude Code Instructions

## What This Project Is

A TypeScript CLI tool (`agent-harness`) that audits a software project for AI coding agent readiness. It scans a repo and produces a scored report across five categories — **instructions, context, tooling, feedback, safety** — with a prioritized fix plan and optional generated starter files.

## Validation Commands

Run these before marking any task done:

```bash
npm run lint        # ESLint on src/ and tests/
npm run typecheck   # tsc --noEmit
npm test            # Vitest (all tests must pass)
npm run build       # tsc → dist/
```

All four must pass clean. No warnings in typecheck or lint.

## Stack Constraints — Do Not Change Without PM Sign-off

- **No bundler** — `tsc` only. Output goes to `dist/`.
- **No `chalk`, `ink`, or any terminal library** — hand-rolled ANSI only.
- **No `commander` or `yargs`** — `minimist` only for CLI parsing.
- **Node.js 20+ ESM** — all imports need explicit `.js` extensions (even for `.ts` source files).
- **Total package size target: under 50KB compressed** — don't add heavy dependencies.

## Module Layout

```
src/
  cli.ts                      # entrypoint — parse args, route to command
  types.ts                    # all shared types (single source of truth)
  commands/
    audit.ts                  # audit command orchestration
  inspection/
    local.ts                  # filesystem evidence collector (no shell exec)
    package.ts                # package.json + lockfile parser
  scoring/
    index.ts                  # score orchestrator
    categories/               # one scorer per category
      instructions.ts
      context.ts
      tooling.ts
      feedback.ts
      safety.ts
tests/
  cli.test.ts
  inspection/local.test.ts
  inspection/package.test.ts
  scoring/scoring.test.ts
fixtures/                     # minimal, partial, strong, ts-webapp fixture repos
```

Planned but not yet implemented (per `docs/technical-spec.md`):
- `src/agents/` — agent adapters for `--deep` flag
- `src/commands/fix.ts` — interactive fix command
- `src/artifacts/generate.ts` — starter file generation
- `src/reporters/text.ts` / `json.ts` — dedicated reporter modules

## Key Files

| File | Purpose |
|---|---|
| `src/types.ts` | **Single source of truth** for all types. Read before adding any new types. |
| `docs/technical-spec.md` | Approved v2.0 spec — module interfaces, scoring rubric, JSON schema. |
| `docs/CONSTRAINTS.md` | Locked constraints (stack, scope, exit codes). Do not change without sign-off. |
| `docs/mvp-plan.md` | Product scope and milestone definitions. |
| `docs/ux-spec-cli.md` | Terminal UX specification — output format, colors, interaction model. |

## Scoring Rubric (Quick Reference)

Five categories, each scored 0–5:

| Category | Weight | Key Checks |
|---|---|---|
| Instructions | 0.25 | AGENTS.md, CLAUDE.md, README, CONTRIBUTING.md |
| Context | 0.20 | architecture docs, docs/ dir, tsconfig.json, .env.example |
| Tooling | 0.20 | package.json, lockfile, lint/typecheck/build scripts |
| Feedback | 0.25 | test script, test dir, test files, CI workflows |
| Safety | 0.10 | .env.example, CONTRIBUTING.md, architecture docs |

Overall score = weighted sum across categories, normalized to 0–100.

## Exit Codes

- `0` — success (audit ran, any score)
- `2` — invalid args, unsupported path, or `--deep` with no agent available
- `3` — unexpected internal error

## Rules

- **All checks in `inspection/local.ts` use `fs/promises` only — no shell exec.**
- **Scoring functions are pure** — same input always returns same output.
- **Never overwrite existing files** — generated artifacts use `.generated.md` suffix and skip if a canonical file exists (e.g., if `AGENTS.md` exists, don't write `AGENTS.generated.md`).
- **Package name**: `agent-harness` is taken on npm. The publishable name is `agent-harness-cli` (see `docs/CONSTRAINTS.md`). The bin entry name stays `agent-harness`.
- Scoring weight adjustments: when `--tool claude-code`, boost `has_claude_md` weight from 0.25 to 0.40 in Instructions (see `docs/technical-spec.md` §6A).

## Claude Code Permissions

```json
{
  "permissions": {
    "allow": [
      "Bash(npm run lint)",
      "Bash(npm run typecheck)",
      "Bash(npm test)",
      "Bash(npm run build)",
      "Bash(node dist/cli.js *)"
    ],
    "deny": [
      "Bash(npm publish *)",
      "Bash(rm -rf *)"
    ]
  }
}
```
