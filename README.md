# Agent Harness Audit

> Beta: `agent-harness` is still in active development and V1 is not finished
> yet. Expect gaps, rough edges, and changes in behavior. Review results
> carefully before relying on them in production workflows.

`agent-harness` scans a JavaScript or TypeScript repository and scores how
ready it is for AI coding agents like Claude Code, Codex, or Cursor. It finds
missing instructions, context, tooling, feedback loops, and safety signals,
then ranks fixes by impact before you hand an agent more autonomy.

Currently focused on JS/TS repos. Other ecosystems may produce incomplete
results.

## Quick start

Requirements: Node.js 20+

The npm package is `agent-harness-cli`. The binary it installs is
`agent-harness`.

```bash
# Zero-install
npx agent-harness-cli audit .

# Or install globally
npm install -g agent-harness-cli
agent-harness audit .
```

`agent-harness` is read-only by default. It only writes files when you pass
`--write-artifacts`.

## Example output

```text
agent-harness v0.1.0  —  Agent-readiness audit for AI coding tools

Auditing: /path/to/repo
Target tools: all

─────────────────────────────────────────────────────
  Agent Harness Score: 3 / 100  ○○○○○○○○○○  NOT READY
─────────────────────────────────────────────────────

  Instructions    ░░░░░  0 / 5     Missing: primary instructions, README
  Context         ░░░░░  0 / 5     Missing: architecture docs, docs index
  Tooling         █░░░░  0.5 / 5   Missing: lockfile, arch lint
  Feedback        ░░░░░  0 / 5     Missing: test script, test dir
  Safety          ░░░░░  0 / 5     Missing: .env.example, architecture docs

─────────────────────────────────────────────────────
  Top Blockers
─────────────────────────────────────────────────────

  1. No primary instruction surface
     No AGENTS.md found at project root.
     → Add AGENTS.md for general use, or CLAUDE.md if this repo is
       intentionally Claude-only.

─────────────────────────────────────────────────────
  Fix Plan
─────────────────────────────────────────────────────

  QUICK (< 30 min)
  ☐ Add a primary instruction surface
  ☐ Add .env.example
  ☐ Add tsconfig.json

  MEDIUM (1–2 hrs)
  ☐ Create a tests/ directory with at least one test file
  ☐ Add a "test" script to package.json
```

## What you get back

Every audit returns a repo-specific report with:

- An overall readiness score out of 100
- Five category scores out of 5:
  instructions, context, tooling, feedback, and safety
- Top blockers: the most important missing signals hurting agent performance
- A prioritized fix plan grouped by effort
- Tool-specific readiness notes for supported ecosystems
- Optional JSON output for automation or CI workflows

Each category is scored from 0 to 5, then weighted into the overall score:
instructions 20%, context 20%, tooling 25%, feedback 25%, safety 10%.

The report is meant to answer one question quickly:

> Before I let an AI coding agent make more changes in this repo, what is
> missing, and what should I fix first?

## What the audit checks

`agent-harness` looks for the repo signals that help coding agents work safely
and predictably, including:

- Instruction surfaces such as `AGENTS.md` and `CLAUDE.md`
- Setup and navigation docs such as `README.md`, `docs/`, and architecture docs
- Tooling signals such as `package.json`, lockfiles, and `lint` / `typecheck` /
  `test` / `build` scripts
- Feedback loops such as tests and CI workflows
- Safety guidance such as `.env.example` and execution expectations

It supports a heuristic local audit by default, plus an optional deep audit mode
that uses a supported coding agent for richer findings.

## CLI reference

```text
agent-harness <command> [path] [options]

Commands:
  audit <path>   Audit a project directory for agent-readiness

Options:
  --tools <list|all>     Target tool ecosystems: claude-code, codex, cursor,
                         copilot, other, all
  --tool <name>          Deprecated alias for --tools <name>
  --failure-mode <text>  Describe what is currently failing
  --safety-level <lvl>   low | medium | high
  --deep                 Run deep audit using a supported coding agent
  --agent <name>         Agent to use for deep audit: claude-code, codex
  --tokens               Show token usage instead of cost in deep mode
  --verbose              Enable verbose output
  --debug                Show debug details on errors
  --no-color             Disable ANSI colors in terminal output
  --json                 Output machine-readable JSON instead of terminal report
  --write-artifacts      Write starter files into the target directory
  --output <file>        Write JSON output to a file (requires --json)
  --version              Print version number
  --help                 Show this help
```

Examples:

```bash
# Audit the current repo
agent-harness audit .

# Audit another repo for all supported tool ecosystems
agent-harness audit /path/to/repo --tools all

# Audit for specific tool ecosystems
agent-harness audit /path/to/repo --tools claude-code,codex

# Add context about the problem you are seeing
agent-harness audit . --failure-mode "regressions after agent edits"

# Tighten expectations for risky repos
agent-harness audit . --safety-level high

# Run a deep audit with a supported coding agent
agent-harness audit . --deep
agent-harness audit . --deep --agent codex

# Get machine-readable output
agent-harness audit . --json
agent-harness audit . --json --output report.json
```

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Audit completed successfully |
| `2` | Invalid arguments, unsupported path, or `--deep` with no supported agent available |
| `3` | Unexpected internal error |

## Generated artifacts

When you pass `--write-artifacts`, the CLI can generate starter files you can
adapt for your repo:

- `AGENTS.generated.md`
- `CLAUDE.generated.md`
- `validation-checklist.generated.md`
- `architecture-outline.generated.md`

Generated artifacts never overwrite existing files. The CLI checks both the
generated filename and the canonical filename before writing. For example, if
`AGENTS.md` already exists, it will not create `AGENTS.generated.md`.

## Local development

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Run the CLI from source after building:

```bash
node dist/cli.js audit .
```

You can also use the Makefile shortcuts with `make help`.

## License

MIT
