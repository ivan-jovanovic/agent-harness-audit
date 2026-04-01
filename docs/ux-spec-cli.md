# UX Spec: `agent-harness` CLI Terminal Experience

**Issue:** [THU-50](/THU/issues/THU-50)
**Status:** Draft — v2 (hybrid audit model)
**Date:** 2026-03-19
**Supersedes:** v1 (2026-03-18)

---

## User Goal

A developer runs `npx agent-harness audit .` in their repo and immediately understands:
1. How agent-ready their project is
2. What is holding them back
3. What to do next

The terminal is the entire product. Every design decision flows from that constraint.

---

## Design Principles

1. **Specific, not generic.** Every output line should reference what was actually found (or not found). No boilerplate conclusions.
2. **Respect developer time.** Skip ceremony. Get to the score fast.
3. **Honest about uncertainty.** The tool uses heuristics. Don't oversell confidence.
4. **Degrade gracefully.** Color and symbols enhance but are never load-bearing. Plain text must still communicate.
5. **Zero surprise writes.** Default mode is read-only. Any file creation requires an explicit flag.

---

## 1. First-Run Experience

### User problem
The first 3 seconds of a CLI tool communicate: *"Is this worth my time?"* A clunky, verbose, or confusing cold start causes immediate abandonment.

### Design

On first run (`npx agent-harness audit .`), the output opens with:

```
agent-harness v0.1.0  —  Agent-readiness audit for AI coding tools

Auditing: /Users/alice/projects/my-app
```

**What this communicates:**
- The tool name and version (signal: this is a real, versioned tool)
- What the tool does in one line (no need to re-read the docs)
- The exact path being audited (signal: it's operating on what you think it is)

**What is intentionally absent from the header:**
- No ASCII art, banners, or splash screens
- No "Welcome to agent-harness!" filler copy
- No progress percentage until scanning starts

**Why:** The user ran a command. They want results. The header earns trust by being minimal and precise.

---

## 2. Progress Feedback

### User problem
Silent-then-result feels like a black box. If the tool takes 2-5 seconds, the developer needs to know it's working and what it's doing — not to entertain them, but to build trust in the process.

### Design: Step-by-step inline output (not a spinner)

Progress is printed as each step completes, not pre-announced. Each step is a single overwritten or appended line depending on terminal capabilities.

```
Auditing: /Users/alice/projects/my-app

  Scanning project structure...  done
  Reading package.json...        done
  Checking docs and instructions...  done
  Checking test signals...       done
  Scoring...                     done
```

Steps appear sequentially, each flushed immediately to stdout. No fake loading bars.

**Why step-by-step over a spinner:**
- Spinners are decorative — they communicate "working" but not "what"
- Steps communicate the rubric passively — developer sees the five categories being checked
- Steps build confidence that the audit found (or didn't find) specific things

**In CI / non-TTY environments:** Steps are printed as static lines (no overwriting). Output is the same content, just without cursor control codes.

**In `--json` mode:** No progress output. Silent until result. (See Section 5.)

---

## 3. Terminal Report Layout

### User problem
Audit results have hierarchy: overall score → categories → individual blockers → fixes. Flattening this into a wall of text makes it unreadable. But over-structuring it with heavy borders looks like enterprise software.

### Design: Three-zone layout

```
─────────────────────────────────────────────────────
  Agent Harness Score: 42 / 100  ●●●●○○○○○○  NEEDS WORK
─────────────────────────────────────────────────────

  This audit scores what agents need to work safely in-repo:
  clear instructions, discoverable context, runnable validation,
  and environment/setup guidance.

  Missing items matter when they remove the agent's ability to
  understand the repo, scope changes, or verify results.

  Instructions    ███░░  3 / 5   Missing: AGENTS.md, repo-local skills
  Context         ███░░  3 / 5   README exists, no architecture docs
  Tooling         █████  5 / 5   package.json ✓  lockfile ✓  scripts ✓
  Feedback        ██░░░  2 / 5   No test directory detected
  Safety          ██░░░  2 / 5   No .env.example, no architecture docs

  Tool-specific readiness
  Claude Code     0 / 5          Missing: CLAUDE.md
  Codex           ░░░░░  n/a     No tool-specific repo-level checks in v2
  Cursor          ░░░░░  n/a     No tool-specific repo-level checks in v2

─────────────────────────────────────────────────────
  Top Blockers
─────────────────────────────────────────────────────

  1. No primary instruction surface
     No AGENTS.md found. Agents operating in this repo have no explicit
     constraints or operating rules. This is the #1 cause of agents editing
     too broadly or making wrong assumptions.
     → Add AGENTS.md with project-specific rules for your coding agent.

  2. No test signals (Feedback: 0 pts)
     No test/ or __tests__/ directory, no *.test.* or *.spec.* files found.
     Without a feedback loop, regressions compound silently. Agents cannot
     verify their own changes.
     → Add at least one test file and a `test` script to package.json.

  3. No environment documentation (Safety: 0 pts)
     No .env.example found. Agents may make incorrect assumptions about
     required environment variables.
     → Add .env.example documenting required vars (values can be blank).

─────────────────────────────────────────────────────
  Fix Plan
─────────────────────────────────────────────────────

  QUICK (< 30 min)
  ☐ Create AGENTS.md with agent operating rules      → Instructions +2
  ☐ Add repo-local skills under .agents/skills/      → Instructions +1
  ☐ Create .env.example with placeholder values      → Safety +1

  TOOL-SPECIFIC FIXES
  ☐ Create CLAUDE.md for Claude Code startup rules   → Claude Code +1
  ☐ Add Claude/Cursor skills for selected tools      → Instructions +1

  MEDIUM (1-2 hrs)
  ☐ Add a test directory with one passing test       → Feedback +2
  ☐ Add a discoverable architecture guide            → Context +1

─────────────────────────────────────────────────────

  Run `agent-harness audit . --write-artifacts` to generate starter files.
```

For single-tool audits, the Instructions category is intentionally conditional:
- `AGENTS.md` remains the default primary instruction surface.
- `CLAUDE.md` can satisfy the primary instructions check in a Claude-only audit, when the repo otherwise presents a single clear Claude-native instruction surface, or when the selected supported tools already have native skills coverage and the repo is using `CLAUDE.md` as the shared root surface.
- Missing `.agents/skills` is not shown as a blocker when exactly one supported tool is selected and that tool already has native skills under `.claude/skills/` or `.cursor/skills/`.

### Layout decisions

**Zone 1 — Score summary:**
- Single line with the number, a visual bar, and a text label (READY / GOOD / NEEDS WORK / NOT READY)
- Horizontal rule above and below — creates strong visual anchor without a box drawing library
- Score bar uses block characters (████░░) which degrade to ASCII in plain text mode
- A short rationale block explains that the audit only scores setup that directly helps agents understand the repo, make scoped changes, and verify work

**Zone 2 — Category table:**
- One line per category: name, bar, score, finding summary
- Finding summary cites specific evidence ("README exists, no architecture docs") — never generic
- Aligned columns — names are padded to equal width

**Zone 3 — Blockers:**
- Max 3 blockers, ranked by scoring impact
- Each blocker: name, why it matters (1-2 sentences grounded in evidence), and a single action arrow (`→`)
- No jargon. "No test directory detected" not "Feedback loop absent"

**Zone 4 — Fix plan:**
- Grouped by effort (QUICK / MEDIUM / HEAVY)
- Checkbox-style list (`☐`) — visual cue that these are actionable
- Each item shows the category score impact as motivation

**Zone 5 — Next step prompt:**
- Single line hint pointing to `--write-artifacts`
- Shown only if score < 80 (suppressed if project is already well-configured)

### Color usage (graceful degradation)

| State | Color | Symbol | Plain text fallback |
|-------|-------|--------|---------------------|
| Score ≥ 80 | Green | ● | READY |
| Score 50–79 | Yellow | ● | GOOD |
| Score 25–49 | Yellow | ● | NEEDS WORK |
| Score < 25 | Red | ● | NOT READY |
| Category pass (5/5) | Green | ██████ | [5/5] |
| Category partial | Yellow | ████░░ | [3/5] |
| Category fail (0-1) | Red | █░░░░ | [1/5] |
| Blocker label | Bold | — | UPPERCASE |
| Action arrow | Cyan | → | -> |

Color is applied via ANSI codes only when stdout is a TTY (`process.stdout.isTTY`). In pipe or redirect mode, all output is plain text.

### Terminal width

- Default layout targets 80 characters wide (standard terminal minimum)
- Category bar width and text truncation adapt at 60, 80, 100 char widths
- No layout breaks below 60 chars — output falls back to a simplified single-column view

---

## 4. Error and Edge-Case UX

### User problem
Cryptic errors (stack traces, undefined paths) destroy trust. The error must tell the developer exactly what happened and what to do.

### Design: Structured error messages

**Pattern:**
```
Error: [what went wrong]
       [why it happened or what was expected]
       [what to do next]
```

**Invalid path:**
```
Error: Path not found — /Users/alice/projects/nonexistent
       Check the path and try again.
       Usage: agent-harness audit <path>
```

**Not a project directory (no package.json, no recognizable project structure):**
```
Error: No project found at /Users/alice/Desktop/random-folder
       agent-harness expects a JavaScript or TypeScript project directory.
       Make sure package.json exists or run from your project root.
```

**Unsupported project type (future: non-JS/TS project detected):**
```
  Note: This looks like a Python project (setup.py detected).
        agent-harness v0.1.0 supports JavaScript/TypeScript projects only.
        Support for additional languages is planned.
        Results may be incomplete.
```
*(Warning, not hard stop — audit still runs, with a caveat line at the top.)*

**No issues found (perfect or near-perfect score):**
```
─────────────────────────────────────────────────────
  Agent Harness Score: 92 / 100  ██████████  READY
─────────────────────────────────────────────────────

  This project is well-configured for AI coding agent use.
  No critical blockers found.

  Opportunities (minor)
  ─ Consider adding an architecture doc (ARCHITECTURE.md) for larger agent tasks.
```
*(Positive result is still useful — confirms the setup is solid and surfaces minor opportunities.)*

**`--write-artifacts` when all files already exist:**
```
  Artifact generation skipped.
  Existing files were not modified:
    ✓ AGENTS.md already exists
    ✓ CLAUDE.md already exists

  File already exists. Review the existing file or delete it before re-running.
```

### Rules for error messages
- Always print the path or value that caused the error
- Never expose stack traces to the user (log to stderr with `--debug` flag only)
- Exit code 0 — success (audit completed, even with a low score)
- Exit code 1 — audit ran but scored below threshold (reserved for `--fail-under`; not used in V1)
- Exit code 2 — invalid arguments, unsupported path, or `--deep` with no agent available
- Exit code 3 — unexpected internal error

---

## 5. `--json` Mode

### User problem
Machine-readable output must be completely clean — no ANSI codes, no human-addressed text, no progress lines. It must be stable enough to pipe into scripts, jq, or CI steps.

### Design rules
- `--json` sends all JSON to stdout, all errors to stderr
- No color codes, no spinner, no progress steps — completely silent until result
- Schema is flat and explicit — no nested surprises
- Version field included for forward compatibility

### JSON schema

```json
{
  "version": "1",
  "generatedAt": "2026-03-18T22:14:00.000Z",
  "input": {
    "path": "/Users/alice/projects/my-app",
    "tool": "claude-code",
    "failureMode": "",
    "safetyLevel": "medium",
    "jsonMode": true,
    "writeArtifacts": false,
    "deep": false,
    "agentName": null,
    "outputFile": null
  },
  "evidence": {
    "files": {
      "hasAgentsMd": false,
      "hasCLAUDEMd": false,
      "hasReadme": true,
      "hasContributing": false,
      "hasArchitectureDocs": false,
      "hasEnvExample": true,
      "hasDocsDir": false
    },
    "packages": {
      "hasPackageJson": true,
      "hasLockfile": true,
      "lockfileType": "pnpm",
      "scripts": {
        "hasLint": true,
        "hasTypecheck": true,
        "hasTest": true,
        "hasBuild": true
      }
    },
    "tests": {
      "hasTestDir": false,
      "hasTestFiles": false,
      "testFramework": null,
      "hasVitestConfig": false,
      "hasJestConfig": false,
      "hasPlaywrightConfig": false
    },
    "workflows": {
      "hasCIWorkflows": false,
      "workflowCount": 0
    },
    "context": {
      "hasTsConfig": true,
      "detectedLanguage": "typescript",
      "detectedFramework": "react",
      "hasEslintConfig": true
    }
  },
  "scoring": {
    "overallScore": 45,
    "categoryScores": [
      {
        "id": "instructions",
        "label": "Instructions",
        "score": 4.0,
        "maxScore": 5,
        "checks": [
          { "id": "has_primary_instructions", "passed": true, "weight": 0.50, "label": "Primary instructions present" },
          { "id": "has_readme",               "passed": true, "weight": 0.10, "label": "README present" },
          { "id": "has_tool_skills",          "passed": true, "weight": 0.30, "label": "Tool skills present" }
        ],
        "failingChecks": []
      },
      {
        "id": "context",
        "label": "Context",
        "score": 2.0,
        "maxScore": 5,
        "checks": [
          { "id": "has_architecture_docs", "passed": false, "weight": 0.35, "label": "Architecture docs exist",   "failureNote": "No discoverable architecture guide found at the repo root or in docs/." },
          { "id": "has_docs_dir",          "passed": false, "weight": 0.25, "label": "docs/ directory exists",   "failureNote": "No docs/ directory found." },
          { "id": "has_tsconfig",          "passed": true,  "weight": 0.25, "label": "tsconfig.json present" },
          { "id": "has_env_example",       "passed": true,  "weight": 0.15, "label": ".env.example present" }
        ],
        "failingChecks": [
          { "id": "has_architecture_docs", "passed": false, "weight": 0.35, "label": "Architecture docs exist",   "failureNote": "No discoverable architecture guide found at the repo root or in docs/." },
          { "id": "has_docs_dir",          "passed": false, "weight": 0.25, "label": "docs/ directory exists",   "failureNote": "No docs/ directory found." }
        ]
      },
      {
        "id": "tooling",
        "label": "Tooling",
        "score": 5.0,
        "maxScore": 5,
        "checks": [
          { "id": "has_package_json",    "passed": true, "weight": 0.20, "label": "package.json present" },
          { "id": "has_lockfile",         "passed": true, "weight": 0.20, "label": "Lockfile present" },
          { "id": "has_lint_script",      "passed": true, "weight": 0.20, "label": "lint script present" },
          { "id": "has_typecheck_script", "passed": true, "weight": 0.20, "label": "typecheck script present" },
          { "id": "has_build_script",     "passed": true, "weight": 0.20, "label": "build script present" }
        ],
        "failingChecks": []
      },
      {
        "id": "feedback",
        "label": "Feedback",
        "score": 1.8,
        "maxScore": 5,
        "checks": [
          { "id": "has_test_script",  "passed": true,  "weight": 0.25, "label": "test script present" },
          { "id": "has_test_dir",     "passed": false, "weight": 0.30, "label": "test directory exists", "failureNote": "No tests/, test/, or __tests__/ directory found." },
          { "id": "has_test_files",   "passed": false, "weight": 0.15, "label": "test files present",    "failureNote": "No *.test.* or *.spec.* files found." }
        ],
        "failingChecks": [
          { "id": "has_test_dir",     "passed": false, "weight": 0.30, "label": "test directory exists", "failureNote": "No tests/, test/, or __tests__/ directory found." },
          { "id": "has_test_files",   "passed": false, "weight": 0.15, "label": "test files present",    "failureNote": "No *.test.* or *.spec.* files found." }
        ]
      },
      {
        "id": "safety",
        "label": "Safety",
        "score": 2.0,
        "maxScore": 5,
        "checks": [
          { "id": "has_env_example",       "passed": true,  "weight": 0.60, "label": "Environment vars documented" },
          { "id": "has_architecture_docs", "passed": false, "weight": 0.40, "label": "Architecture guidance exists",    "failureNote": "No architecture documentation found." }
        ],
        "failingChecks": [
          { "id": "has_architecture_docs", "passed": false, "weight": 0.40, "label": "Architecture guidance exists",    "failureNote": "No architecture documentation found." }
        ]
      }
    ],
    "topBlockers": [
      {
        "categoryId": "instructions",
        "checkId": "has_primary_instructions",
        "title": "No primary instruction surface",
        "why": "No AGENTS.md found. Agents have no explicit constraints or operating rules.",
        "likelyFailureMode": "Agent edits too broadly or makes wrong assumptions about project structure and conventions.",
        "effort": "quick"
      },
      {
        "categoryId": "feedback",
        "checkId": "has_test_dir",
        "title": "No test directory",
        "why": "test script exists but no test directory was found. Agents cannot verify their own changes.",
        "likelyFailureMode": "Regressions introduced by agent changes go undetected until manual review.",
        "effort": "medium"
      },
      {
        "categoryId": "context",
        "checkId": "has_architecture_docs",
        "title": "No architecture documentation",
        "why": "No discoverable architecture guide was found at the repo root or in docs/. Agents cannot build a stable mental model of the codebase structure from documentation.",
        "likelyFailureMode": "Agents make structural changes with weak understanding of boundaries, ownership, and data flow.",
        "effort": "heavy"
      }
    ],
    "fixPlan": [
      { "categoryId": "instructions", "checkId": "has_primary_instructions", "action": "Create AGENTS.md with agent operating rules", "effort": "quick",  "priority": 1 },
      { "categoryId": "feedback",     "checkId": "has_test_dir",          "action": "Add a test directory with one passing test",      "effort": "medium", "priority": 3 },
      { "categoryId": "context",      "checkId": "has_architecture_docs", "action": "Add a discoverable architecture guide at the repo root or in docs/",     "effort": "heavy",  "priority": 4 }
    ]
  },
  "artifacts": [
    {
      "id": "agents",
      "filename": "AGENTS.generated.md",
      "targetPath": "/Users/alice/projects/my-app/AGENTS.generated.md",
      "skipped": false,
      "written": false,
      "content": "# Agent Instructions\n..."
    }
  ]
}
```

**What `--json` mode must never include:**
- ANSI color escape codes
- Progress step lines
- Human-addressed copy ("Run this command to fix...")
- Non-JSON text before or after the JSON block
- Trailing commas or comments (strict JSON only)

**`--output path/to/file.json`:** Writes JSON to the specified file, prints a single confirmation line to stdout:
```
Report written to: audit-report.json
```

---

## 6. Artifact Generation UX

### User problem
When `--write-artifacts` runs, the developer needs to know exactly what was created, where it is, and what to do with it — without burying the information.

### Design

```
─────────────────────────────────────────────────────
  Artifacts Generated
─────────────────────────────────────────────────────

  ✓ Created: AGENTS.generated.md
    Agent operating rules starter — review and rename to AGENTS.md

  ✓ Created: validation-checklist.generated.md
    Pre-merge validation checklist — adapt to your workflow

  ✗ Skipped: CLAUDE.generated.md
    Run with --tools claude-code to include Claude-specific guidance.
    Run: agent-harness audit . --tools claude-code --write-artifacts

─────────────────────────────────────────────────────
  Next steps

  1. Review generated files — they are starters, not final docs.
  2. Rename from .generated.md to the canonical filename when ready.
  3. Re-run the audit to see your score update.
─────────────────────────────────────────────────────
```

**Design decisions:**
- Every generated file gets a one-line description of what it is and what to do with it
- Skipped files explain *why* they were skipped and how to fix it
- The `.generated.md` suffix is surfaced prominently — user knows these are drafts
- "Next steps" section is numbered — guides first-time users through the workflow
- Re-run suggestion closes the loop (the audit becomes iterative)

**On conflict / file already exists:**
```
  ✗ Skipped: AGENTS.generated.md
    File already exists. Review the existing file or delete it before re-running.
```
No silent overwrites. Ever.

---

## 7. CLI Feel and Tone

### The personality: Direct, specific, respectful

**Not:**
- Cheerful/corporate ("Great news! Your project scored 42/100! 🎉")
- Harsh/critical ("Your project is poorly configured.")
- Vague/hand-wavy ("Consider improving your agent setup.")
- Verbose/padded (3 sentences where 1 will do)

**Yes:**
- Honest and specific ("No AGENTS.md found. Agents have no operating rules.")
- Action-oriented ("→ Add AGENTS.md with project-specific rules.")
- Explains the *why* briefly ("This is the #1 cause of agents editing too broadly.")
- Treats the developer as capable ("Review and rename to AGENTS.md")

### Voice rules

1. **Evidence-first.** Every finding cites what was detected: "No AGENTS.md found" not "Instructions score is low."
2. **One sentence per explanation.** The *why* behind a blocker is one sentence. If it takes more, the finding is too abstract.
3. **Actions use the imperative.** "Add .env.example" not "You might want to consider adding..."
4. **Score labels are calibrated, not judgmental.** READY / GOOD / NEEDS WORK / NOT READY — not EXCELLENT / POOR / FAILING.
5. **No padding.** No "Thank you for using agent-harness." No sign-off lines. The result ends when there's nothing more to say.

### What this sounds like in practice

| Situation | Wrong tone | Right tone |
|-----------|-----------|------------|
| No AGENTS.md | "Your instructions category needs improvement" | "No AGENTS.md found" |
| High score | "Congratulations! Your project is agent-ready! 🚀" | "This project is well-configured for AI coding agent use." |
| Path error | "Oops! That path doesn't seem to exist 😅" | "Error: Path not found — /path/to/dir" |
| After artifact write | "Done! We've created some helpful starter files for you!" | "Created: AGENTS.generated.md — review and rename to AGENTS.md" |

---

## 8. `--deep` Mode UX (AI-Augmented Audit)

### User problem
The standard heuristic audit checks file existence and script presence — fast and deterministic, but blind to quality. A developer with an AGENTS.md that consists of three words still scores full marks. `--deep` delegates analysis to a coding agent that reads actual file content and provides repo-specific insight. This changes the user's expectation: they've opted into a slower, costlier run and expect qualitatively better findings.

### Design: Two-phase progress with cost framing

The deep mode output has two phases:
1. **Fast phase** — same heuristic steps as the standard audit (immediate, sub-second)
2. **Deep phase** — agent analysis with animated dots, time estimate, and cost framing

```
agent-harness v0.2.0  —  Agent-readiness audit for AI coding tools

Auditing: /Users/alice/projects/my-app

  Scanning project structure...  done
  Reading package.json...        done
  Checking docs and instructions...  done
  Checking test signals...       done
  Scoring (heuristic)...         done

  Running deep analysis via claude-code
  Estimated cost: ~$0.02  (≈8k tokens)

  Reading agent instructions...       ·
  Reviewing test coverage patterns... ·
  Checking code conventions...        ·
  Evaluating safety signals...        done (18s)

  Actual cost: $0.019  (7,842 tokens)
```

**Design decisions:**

- Estimated cost line appears before the agent phase begins. Developer sees the cost before tokens are spent. Cost estimate is clearly approximate (`~`).
- Animated dots (`. .. ... done`) on each agent step provide liveness feedback during a 10–30s wait without fake precision.
- Actual cost and token count appear after the agent phase completes — confirms what was spent.
- Cost unit: dollars by default. Add `--tokens` flag to display raw token counts instead.
- In CI / non-TTY: animated dots are replaced with static `...` and printed as a single line when done.

### Agent detection and selection

Before the deep phase starts, the tool auto-detects available coding agents:

```
  Detected: claude-code (claude-code v1.2.0)
```

If multiple agents are found:
```
  Detected agents: claude-code, codex
  Using: claude-code  (first detected — override with --agent)
```

If no agent is found:
```
  Warning: No coding agent found in PATH.
           --deep requires claude-code or codex to be installed.
           Install claude-code: https://docs.anthropic.com/claude-code
           Run without --deep for a heuristic-only audit.
```
*(Warn and exit with code 2. Never fall back silently to heuristic mode when `--deep` was explicit.)*

**`--agent <name>` flag:**
Explicit agent selection. Skips auto-detection. Errors if the specified agent is not found:
```
  Error: Agent 'cursor' not found in PATH.
         Supported agents: claude-code, codex
         Run without --agent to auto-detect.
```

### Token cost display in standard output

Token cost (for `--deep` runs) appears in two places:
1. Pre-run estimate line (before agent call)
2. Post-run actual cost line (after agent completes)

In JSON output (`--json`), cost data is included in the report schema (see Section 5).

---

## 9. Mixed Results Display

### User problem
When `--deep` augments heuristic results, a finding might come from a deterministic file-existence check or from AI analysis of file content. These have different epistemic statuses: heuristic findings are certain, agent findings are probabilistic. The developer needs to know which is which so they can weigh them appropriately.

### Design: Source markers on findings

Each finding in Zones 2–3 carries a source marker:

- Heuristic findings: no marker (the default, baseline behavior)
- AI-augmented findings: `◆` marker in the category table and blocker list

**Zone 2 with mixed sources:**
```
─────────────────────────────────────────────────────
  Agent Harness Score: 54 / 100  ●●●●●○○○○○  NEEDS WORK
─────────────────────────────────────────────────────

  Instructions    ███░░  3 / 5   AGENTS.md present — contents too generic ◆
  Context         ███░░  3 / 5   README exists, no architecture docs
  Tooling         █████  5 / 5   package.json ✓  lockfile ✓  scripts ✓
  Feedback        ██░░░  2 / 5   No test directory detected
  Safety          ███░░  4 / 5   .env.example present — missing key vars ◆
```

**Zone 3 AI-sourced blocker:**
```
  1. Agent instructions exist but are too generic (Instructions: -1 pt)  ◆ AI finding
     AGENTS.md was found but contains only 2 sentences with no project-specific
     constraints. Agents will still operate with broad latitude.
     → Expand AGENTS.md with specific rules for your tech stack and workflow.
     Confidence: high
```

**Source marker rules:**
- `◆` appears at end of the category-table finding summary
- `◆ AI finding` label appears on the blocker title line (not inline with text)
- `Confidence:` line added to AI-sourced blockers only — values: `high` / `medium` / `speculative`
- In plain text mode (no ANSI): `◆` degrades to `[AI]`

### Confidence levels

| Level | Meaning | When used |
|-------|---------|-----------|
| `high` | Agent observed a clear, specific signal in file content | Citing exact file contents, missing required sections |
| `medium` | Agent inferred from patterns that may have exceptions | Code convention judgements, coverage estimates |
| `speculative` | Agent could not find enough evidence — inference only | Large repos with partial analysis, ambiguous signals |

`speculative` findings are grouped separately at the bottom of Zone 3 under:
```
  Note (speculative — limited evidence)
  ─ AGENTS.md may be missing TypeScript-specific constraints ◆
    Confidence: speculative — only 40% of source files were analyzed.
```

---

## 10. `fix .` Command Flow (V1)

### User problem
The audit tells developers what to fix but creates a gap: they leave the terminal, open an editor, and attempt to create files based on generic advice. `fix .` closes that gap by delegating fix generation to a coding agent and letting the developer review each change inline.

This is an interactive session. The developer is in control at every step. No change is applied without explicit confirmation.

### Design: Sequential per-fix review

```
agent-harness v0.2.0  —  Interactive fix mode

Analyzing /Users/alice/projects/my-app via claude-code
Estimated cost: ~$0.05  (≈18k tokens)

  Scanning project for fix targets...  done
  Generating repo-specific fixes...    done (22s)

Actual cost: $0.048  (17,621 tokens)
3 fixes proposed. Review each and accept or reject.

─────────────────────────────────────────────────────
  Fix 1 of 3: Create AGENTS.md
  Category: Instructions  ·  Effort: quick
─────────────────────────────────────────────────────

  + # Agent Instructions
  +
  + ## Project: my-app
  + React + TypeScript web app using Vite and Vitest.
  +
  + ## Operating rules
  + - All components live in src/components/. Do not create new top-level directories.
  + - Run `npm test` before submitting any changes.
  + - Do not modify vite.config.ts without checking with the team.
  + - API calls go through src/api/client.ts only.
  +
  + [... 8 more lines — run with --verbose to see full content]

  Accept? [Y/n/skip/quit]
```

**Prompt options:**
- `Y` (default) — apply the fix, move to next
- `n` — reject and skip, move to next
- `skip` — same as `n`, explicit alias
- `quit` — exit without applying further fixes (already-accepted fixes are retained)
- `?` — print help for these options

After each accept/reject, a status line confirms the action:
```
  ✓ Applied: AGENTS.md created
```
or:
```
  ✗ Skipped: Fix rejected
```

### Session summary

After all fixes are reviewed:
```
─────────────────────────────────────────────────────
  Fix session complete
─────────────────────────────────────────────────────

  ✓ Applied  AGENTS.md
  ✗ Skipped  .env.example (existing file not overwritten)
  ✓ Applied  tests/placeholder.test.ts

  2 of 3 fixes applied.
  Re-run `agent-harness audit .` to see your updated score.
```

**Design decisions:**

- **No silent applies.** Every fix requires a Y or explicit Enter. No bulk-apply mode in V1.
- **File conflict guard.** If a target file already exists, the fix is shown as a diff (lines prefixed `+`/`-`). Developer sees exactly what changes. The prompt asks: `This modifies an existing file. Accept? [Y/n]`
- **No partial writes.** Each fix is atomic: either the full file is written, or nothing.
- **`quit` safety.** Exiting mid-session prints which fixes were applied before quit, so the developer knows the repo state.
- **Verbose flag.** By default, long file previews are truncated with a "N more lines" note. `--verbose` shows the full content.

### `fix .` in non-interactive mode (CI / piped)

When stdout is not a TTY, `fix .` exits immediately with:
```
  Error: fix command requires an interactive terminal.
         Use --json to generate a fix plan without applying changes.
```
Exit code 2. `fix . --json` outputs the proposed fixes as structured JSON to stdout (same base schema as `audit . --json`, with a `fixes` array added).

### Preview format

Each fix preview uses a diff-style prefix:
- `+` lines: content being added (green in TTY, `+` prefix in plain text)
- `-` lines: content being removed (red in TTY, `-` prefix in plain text)
- ` ` lines (no prefix): unchanged context lines

Truncation rule: show first 15 lines of diff. If the full diff is longer, print:
```
  [... N more lines — run with --verbose to see full content]
```

---

## 11. CLI Flag Reference

All flags for `agent-harness audit` and `agent-harness fix`:

### `agent-harness audit <path>`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--tools <list\|all>` | enum | all | Specify the target tools being audited: `claude-code \| cursor \| copilot \| codex \| other \| all`. Core scoring stays tool-neutral, but Instructions considers the selected tools when checking `CLAUDE.md`, `.agents/skills/`, `.claude/skills/`, and `.cursor/skills/` |
| `--tool <name>` | enum | — | Deprecated alias for `--tools <name>` |
| `--failure-mode <text>` | string | — | Describe the failure mode context (e.g. `"regressions after edits"`). Stored as metadata; included in JSON output and text report header. No effect on scoring in V1 |
| `--safety-level <level>` | enum | — | Set the safety level context: `low \| medium \| high`. Stored as metadata; included in JSON output and text report header. No effect on scoring in V1 |
| `--deep` | boolean | false | Delegate audit to a coding agent for AI-augmented analysis |
| `--agent <name>` | string | auto | Select coding agent (`claude-code`, `codex`). Requires `--deep` |
| `--tokens` | boolean | false | Display token counts instead of dollar cost (with `--deep`) |
| `--json` | boolean | false | Output machine-readable JSON to stdout. Suppresses all human output |
| `--output <file>` | string | — | Write JSON report to a file (requires `--json`) |
| `--write-artifacts` | boolean | false | Generate starter files (AGENTS.md, etc.) into the project |
| `--no-color` | boolean | false | Disable ANSI color codes |
| `--debug` | boolean | false | Print stack traces and verbose error info to stderr |

### `agent-harness fix <path>`

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--agent <name>` | string | auto | Select coding agent for fix generation |
| `--tokens` | boolean | false | Display token counts instead of dollar cost |
| `--verbose` | boolean | false | Show full file content in previews (no truncation) |
| `--json` | boolean | false | Output fix plan as JSON without applying any changes |
| `--no-color` | boolean | false | Disable ANSI color codes |
| `--debug` | boolean | false | Print stack traces and verbose error info to stderr |

### Help text (`agent-harness --help`)

```
Usage: agent-harness <command> <path> [flags]

Commands:
  audit <path>    Run agent-readiness audit on a project directory
  fix <path>      Interactively apply AI-generated fixes to a project

Flags for audit:
  --tools <list|all>  Target tools: claude-code | cursor | copilot | codex | other | all
  --failure-mode <text>  Failure mode context (metadata only)
  --safety-level <level>  Safety context: low | medium | high (metadata only)
  --deep          AI-augmented audit via coding agent (slower, more specific)
  --agent <name>  Select agent: claude-code | codex  (requires --deep)
  --tokens        Show token counts instead of dollar cost
  --json          Machine-readable JSON output
  --output <f>    Write JSON to file (requires --json)
  --write-artifacts  Generate starter files into project
  --no-color      Disable ANSI codes
  --debug         Verbose error output to stderr

Flags for fix:
  --agent <name>  Select agent: claude-code | codex
  --tokens        Show token counts instead of dollar cost
  --verbose       Show full file previews (no truncation)
  --json          Output fix plan as JSON (no changes applied)
  --no-color      Disable ANSI codes
  --debug         Verbose error output to stderr

Examples:
  agent-harness audit .
  agent-harness audit . --deep
  agent-harness audit . --deep --agent claude-code
  agent-harness audit . --json --output report.json
  agent-harness fix .
  agent-harness fix . --verbose
```

---

## 12. JSON Schema Updates for Hybrid Model

The base schema from Section 5 is extended for `--deep` runs:

```json
{
  "version": "1",
  "generatedAt": "2026-03-19T10:00:00.000Z",
  "input": {
    "path": "/Users/alice/projects/my-app",
    "tool": "claude-code",
    "deep": true,
    "agentName": "claude-code",
    "failureMode": "",
    "safetyLevel": "medium",
    "jsonMode": true,
    "writeArtifacts": false
  },
  "deepAudit": {
    "agentName": "claude-code",
    "tokenEstimate": 7842,
    "tokensActual": 7600,
    "costEstimateUsd": 0.02,
    "costActualUsd": 0.019,
    "durationMs": 18200,
    "findings": [
      {
        "categoryId": "instructions",
        "checkId": "has_primary_instructions",
        "passed": false,
        "label": "Primary instructions present",
        "evidence": "AGENTS.md contains 2 sentences with no tech stack or workflow rules.",
        "failureNote": "AGENTS.md exists but lacks project-specific constraints."
      }
    ]
  },
  "evidence": { "...": "same as V1 schema" },
  "scoring": { "...": "same as V1 schema, with source field added to each check" }
}
```

**`fix . --json` output schema:**

```json
{
  "version": "1",
  "generatedAt": "2026-03-19T10:05:00.000Z",
  "command": "fix",
  "agentName": "claude-code",
  "tokenEstimate": 17621,
  "tokensActual": 17500,
  "costEstimateUsd": 0.05,
  "costActualUsd": 0.048,
  "fixes": [
    {
      "id": "create_agents_md",
      "categoryId": "instructions",
      "effort": "quick",
      "targetPath": "/Users/alice/projects/my-app/AGENTS.md",
      "action": "create",
      "content": "# Agent Instructions\n..."
    }
  ]
}
```

---

## 13. Voice Rules for AI-Generated Findings

AI-sourced findings follow the same evidence-first, imperative style as heuristic findings with two additions:

1. **Confidence indicator.** Every AI finding states its confidence level.
2. **Evidence citation.** The finding body must name the specific signal observed (file content, pattern, absence).

**Rules:**

1. Same imperative action style: "Expand AGENTS.md" not "You might want to expand..."
2. Evidence-first opening: "AGENTS.md contains only 2 sentences..." not "Instructions quality is low..."
3. Confidence stated plainly: "Confidence: high" at the end of the finding body
4. Non-determinism acknowledged only when relevant: findings below `high` confidence include a brief note like "based on partial file analysis"
5. No hedging language in the finding body itself ("possibly", "might", "seems to") — move uncertainty into the confidence field instead

**Voice table (AI findings):**

| Situation | Wrong | Right |
|-----------|-------|-------|
| Weak AGENTS.md | "Your agent instructions could be improved" | "AGENTS.md lacks project-specific constraints — 2 sentences with no rules" |
| Missing test patterns | "Test coverage seems insufficient" | "No `*.test.*` files found in src/. Agent changes cannot be validated locally. Confidence: high" |
| Ambiguous architecture | "Architecture docs might be needed" | "No discoverable architecture guide found at the repo root or in docs/. Large agent tasks lack scope guidance. Confidence: medium" |
| Low-confidence inference | "This repo probably needs more validation" | "No `*.test.*` files found. Agent changes are weakly validated locally. Confidence: speculative — only top-level test locations scanned" |

---

## 14. Reference CLI Tools

Three tools that represent the quality bar `agent-harness` should aspire to match:

### 1. ESLint (`eslint src/`)
**Why it's the benchmark:**
- Results are tied to specific files and line numbers — nothing is abstract
- Severity levels (error/warning) are visually clear without being noisy
- Output is scannable at a glance: file path → rule name → message
- `--fix` mode communicates exactly what changed and what was left
- Machine-readable via `--format json` with a clean, stable schema

**Borrow from ESLint:** Evidence-grounded findings, clear severity hierarchy, stable JSON schema.

### 2. Vitest (`vitest run`)
**Why it's the benchmark:**
- Progress is communicated with intelligence: you see which test suites are running
- Summary line at the end is immediate and readable (X passed, Y failed, duration)
- Failures show the diff between expected and received — not just "test failed"
- Color use is purposeful: green = pass, red = fail — never decorative
- The tool feels fast even when it isn't, because feedback is continuous

**Borrow from Vitest:** Inline progress that builds trust, summary-first result format, color as semantic signal.

### 3. `npm audit`
**Why it's the benchmark:**
- Audit model with severity tiers maps directly to `agent-harness` score categories
- "X vulnerabilities found" → drill-down per finding is a natural reading flow
- Fix suggestion (`npm audit fix`) is surfaced at the end, not buried
- Exit codes are meaningful and documented — scriptable by default
- Terse in the happy path: "found 0 vulnerabilities" is the entire output when clean

**Borrow from npm audit:** Score/severity tiering, drill-down structure, exit code semantics, clean happy-path output.

---

## Accessibility Notes

- All color signals are paired with text labels or symbols (never color-only)
- Block characters (`█`) used in bars degrade to `[X/5]` format when `NO_COLOR=1` or `--no-color` flag is set
- Screen reader compatibility: progress steps are single lines ending with a newline (not cursor-overwritten)
- Minimum column width: 60 chars. At narrow widths, layout simplifies to one item per line

---

## Component Inventory

| Component | Description | Notes |
|-----------|-------------|-------|
| `Header` | Tool name, version, target path | Always first |
| `ProgressStep` | Step name + "done" | Suppressed in `--json` mode |
| `DeepProgressBlock` | Agent detection, cost estimate, animated steps, actual cost | `--deep` only; static in non-TTY |
| `ScoreBanner` | Score number, bar, label | Zone 1 |
| `CategoryTable` | Per-category score rows with optional `◆` AI source marker | Zone 2 |
| `BlockerList` | Top 3 blockers with reason + action; AI blockers include confidence level | Zone 3 |
| `SpeculativeFindings` | Low-confidence AI findings grouped separately | Zone 3, `--deep` only, conditional |
| `FixPlan` | Effort-grouped checklist | Zone 4 |
| `NextStepHint` | Single-line prompt for next action | Zone 5, conditional |
| `ErrorMessage` | Structured 3-line error | stderr |
| `ArtifactReport` | Per-file created/skipped list | After `--write-artifacts` |
| `JsonOutput` | Full JSON to stdout | `--json` mode only |
| `FixHeader` | Fix mode header with agent name and cost estimate | `fix .` command only |
| `FixPreview` | Diff-style preview of a single proposed fix | `fix .` command only |
| `FixPrompt` | Y/n/skip/quit interactive prompt | `fix .`, TTY only |
| `FixSessionSummary` | Per-fix applied/skipped summary + re-run hint | `fix .` command end |

---

## Interaction States Summary

| State | Output |
|-------|--------|
| Normal run | Header → Progress → Report |
| `--deep` run | Header → Heuristic progress → Agent detection → Cost estimate → Deep progress → Actual cost → Report with `◆` markers |
| `--deep` no agent found | Header → Heuristic progress → Warning: no agent → exit 2 |
| `--agent <name>` not found | Error: agent not found → exit 2 |
| `fix .` (interactive) | Header → Agent detection → Cost estimate → Fix generation → Per-fix preview + prompt loop → Session summary |
| `fix .` (non-TTY) | Error: interactive terminal required → exit 2 |
| `fix . --json` | Silent → fix plan JSON to stdout |
| `--json` | Silent → JSON to stdout |
| `--json --output file` | Silent → file write → confirmation line |
| `--write-artifacts` | Normal run → Artifact report → Next steps |
| Path error | Error message → exit 2 |
| Invalid flag | Usage hint → exit 2 |
| No issues found | Score banner → "No critical blockers" → Opportunities |
| File conflict on `--write-artifacts` | Skip notice per file → no exit error |
| CI / non-TTY | Same as normal run, no ANSI codes |
