# Check Explanation Quality Bar

**Owner:** Product Manager
**Date:** 2026-03-18
**Status:** Accepted — use as acceptance criteria for Task 5 (terminal reporter) and Task 4 (scoring engine)

---

## Purpose

This document defines the concrete quality bar for every check explanation in the terminal report. It is the primary defense against the "generic checklist" failure mode.

**The rule:** Every explanation must cite specific evidence from the repo. No black-box reasoning. No generic advice.

**Voice rules (from UX spec):**
- One sentence per explanation where possible
- Evidence-first — name the file, folder, or signal that was found (or not found)
- Action text is a directive, not a suggestion ("Add X" not "Consider adding X")
- No jargon that needs translating ("Feedback loop absent" → "No test directory found")

---

## Quality Bar by Check

### Instructions

---

#### `has_agents_md` — AGENTS.md present

| | Text |
|---|---|
| **GOOD** | No AGENTS.md found at project root — the agent starts every session with no project-specific operating rules. |
| **BAD** | Your instructions score is low. Consider adding documentation for your agent. |
| **Action** | Create AGENTS.md at your project root with operating rules, common tasks, and validation commands. |

**Why the GOOD example works:** It names the missing file, its expected location, and the exact consequence. The reader immediately knows what was checked and what it means.

**Why the BAD example fails:** "Instructions score is low" is a score label, not an observation. "Consider adding documentation" is advice that could apply to any project.

---

#### `has_claude_md` — CLAUDE.md present

| | Text |
|---|---|
| **GOOD** | No CLAUDE.md found — Claude Code will not load any project-level configuration at startup. |
| **BAD** | Missing project configuration file for Claude. |
| **Action** | Create CLAUDE.md at your project root. Claude Code reads this file automatically at the start of every session. |

---

#### `has_readme` — README present

| | Text |
|---|---|
| **GOOD** | No README.md found — agents have no onboarding document to orient from before exploring the codebase. |
| **BAD** | Your context score is low. Add a README to improve it. |
| **Action** | Add README.md to the project root with a description, setup steps, and basic usage. |

---

#### `has_contributing` — CONTRIBUTING.md present

| | Text |
|---|---|
| **GOOD** | No CONTRIBUTING.md found — agents have no documented contribution model to follow (branch strategy, commit conventions, review process). |
| **BAD** | Missing contribution documentation. |
| **Action** | Add CONTRIBUTING.md describing your branch strategy, commit format, and how changes get reviewed. |

---

### Context

---

#### `has_architecture_docs` — Architecture docs exist

| | Text |
|---|---|
| **GOOD** | No ARCHITECTURE.md or docs/architecture.* found — agents cannot build a stable mental model of the codebase structure from documentation. |
| **BAD** | Your context score is low. Consider documenting your architecture. |
| **Action** | Add ARCHITECTURE.md or docs/architecture.md describing key directories, data flow, and major design decisions. |

---

#### `has_docs_dir` — docs/ directory exists

| | Text |
|---|---|
| **GOOD** | No docs/ directory found — there is no structured location for project documentation the agent can reference. |
| **BAD** | Consider creating a docs folder for better context. |
| **Action** | Create a docs/ directory and move or start any project documentation there. |

---

#### `has_tsconfig` — tsconfig.json present

| | Text |
|---|---|
| **GOOD** | No tsconfig.json found — the agent cannot determine the TypeScript configuration, module system, or compiler targets for this project. |
| **BAD** | TypeScript configuration is missing. |
| **Action** | Add tsconfig.json to the project root. Run `npx tsc --init` for a sensible default, then adjust for your build target. |

---

#### `has_env_example` — .env.example present

| | Text |
|---|---|
| **GOOD** | No .env.example found — agents may create or modify code that references environment variables without knowing which are required or what format they take. |
| **BAD** | Environment documentation is missing. |
| **Action** | Add .env.example listing all required environment variable names. Values can be blank or use placeholder text like `your_key_here`. |

---

### Tooling

---

#### `has_package_json` — package.json present

| | Text |
|---|---|
| **GOOD** | No package.json found — the agent cannot determine project dependencies, scripts, or runtime configuration. |
| **BAD** | Project setup is incomplete. |
| **Action** | Run `npm init` (or `pnpm init`) to create package.json at the project root. |

---

#### `has_lockfile` — Lockfile present

| | Text |
|---|---|
| **GOOD** | No lockfile found (expected package-lock.json, pnpm-lock.yaml, or yarn.lock) — dependency versions are not pinned and installations may not be reproducible. |
| **BAD** | Dependency management is inconsistent. Consider using a lockfile. |
| **Action** | Run `npm install` (or your package manager's install command) to generate a lockfile and commit it. |

---

#### `has_lint_script` — lint script present

| | Text |
|---|---|
| **GOOD** | No `lint` script found in package.json — the agent has no standard command to check code style and catch common errors after making changes. |
| **BAD** | Linting is not configured. |
| **Action** | Add a `"lint"` script to package.json. Example: `"lint": "eslint src --ext .ts,.tsx"`. |

---

#### `has_typecheck_script` — typecheck script present

| | Text |
|---|---|
| **GOOD** | No `typecheck` script found in package.json — the agent cannot run a type-only check without triggering a full build. |
| **BAD** | TypeScript checking is not set up. |
| **Action** | Add `"typecheck": "tsc --noEmit"` to your package.json scripts. |

---

#### `has_build_script` — build script present

| | Text |
|---|---|
| **GOOD** | No `build` script found in package.json — the agent has no standard command to verify the project compiles successfully. |
| **BAD** | Build configuration is missing. |
| **Action** | Add a `"build"` script to package.json that compiles or bundles your project (e.g., `"build": "tsc"` or `"build": "next build"`). |

---

### Feedback

---

#### `has_test_script` — test script present

| | Text |
|---|---|
| **GOOD** | No `test` script found in package.json — the agent has no standard command to run the test suite after making changes. |
| **BAD** | Testing is not configured. |
| **Action** | Add a `"test"` script to package.json pointing to your test runner (e.g., `"test": "vitest run"` or `"test": "jest"`). |

---

#### `has_test_dir` — test directory exists

| | Text |
|---|---|
| **GOOD** | No tests/, test/, or __tests__/ directory found — there is no test suite for the agent to run or extend when making changes. |
| **BAD** | Your feedback score is low. Adding tests would help. |
| **Action** | Create a tests/ directory and add at least one test file. Even a single passing test gives the agent a feedback loop. |

---

#### `has_test_files` — test files present

| | Text |
|---|---|
| **GOOD** | No *.test.* or *.spec.* files found at the project root — there are no co-located test files for the agent to reference when adding or modifying features. |
| **BAD** | Test coverage is insufficient. |
| **Action** | Add test files alongside your source files (e.g., `src/utils.test.ts`) or inside a dedicated test directory. |

---

#### `has_ci_workflows` — CI workflows present

| | Text |
|---|---|
| **GOOD** | No .github/workflows/*.yml files found — there is no automated validation step that runs on every push or pull request. |
| **BAD** | CI is not set up. This affects your feedback score. |
| **Action** | Add a GitHub Actions workflow file at .github/workflows/ci.yml that runs lint, typecheck, and tests on push. |

---

## Summary: the single test

Before shipping any check explanation text, ask:

> **Could this explanation appear in any random JS/TS repo, or does it only make sense in a repo where the check actually failed?**

If it could appear anywhere, it's generic. Rewrite it so it names the specific file, directory, or signal that was absent.

---

## Notes for Engineer (Task 4 and Task 5)

- The `failureNote` field in `CheckResult` maps directly to the GOOD examples above. These are the strings to ship.
- The action text maps to `FixItem.action` in the fix plan.
- The BAD examples are not shipped — they are here to calibrate your review of any auto-generated or template text.
- When the UX Designer reviews terminal output, they should use the GOOD/BAD contrast above as the rubric. A line that reads like a BAD example must be rewritten before the task is considered done.
