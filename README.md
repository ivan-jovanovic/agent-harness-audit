# agent-harness

Audit a project for agent-readiness before giving AI coding agents broad autonomy.

Scans a repository and produces a scored report across five core categories — **instructions**, **context**, **tooling**, **feedback**, and **safety** — plus tool-specific readiness overlays, identifying blockers and a prioritised fix plan.

## Install

```bash
npm install -g agent-harness-cli
```

Or run directly with npx:

```bash
npx agent-harness-cli audit .
```

## Usage

```
agent-harness <command> [path] [options]

Commands:
  audit <path>   Audit a project directory for agent-readiness
                 Defaults to current working directory if no path given

Options:
  --tools <list|all>     Target tools to audit: claude-code, codex, cursor,
                         copilot, other, or all (default)
  --tool <name>          Deprecated alias for --tools <name>
  --failure-mode <text>  Describe what is currently failing (free text)
  --safety-level <lvl>   low | medium | high  (default: medium)
  --json                 Output machine-readable JSON instead of terminal report
  --write-artifacts      Write starter files into the target directory
  --output <file>        Write JSON output to a file (requires --json)
  --version              Print version number
  --help                 Show this help
```

### Examples

```bash
# Audit current directory
agent-harness audit .

# Audit a specific repo for all supported target tools
agent-harness audit /path/to/repo --tools all

# Audit a specific repo, targeting Claude Code and Codex
agent-harness audit /path/to/repo --tools claude-code,codex

# Machine-readable output
agent-harness audit . --json --output report.json

# Write starter agent config files into the repo
agent-harness audit . --write-artifacts
```

## Scoring categories

| Category     | What it checks |
|--------------|----------------|
| instructions | Primary instructions plus repo-local skills. `AGENTS.md` is the default primary surface; `CLAUDE.md` can also satisfy the primary check when the repo uses Claude as its native instruction surface or when the selected supported tools are fully covered by native Claude/Cursor skills. Generic skills live under `.agents/skills`, and Claude/Cursor native skills live under `.claude/skills` and `.cursor/skills`. |
| context      | README, architecture docs, docs/ structure, env examples |
| tooling      | Package scripts (lint, typecheck, test, build), lockfile |
| feedback     | Test command and test-file signals |
| safety       | .env.example, architecture guidance |

Each category is scored 0–5. The overall score drives a colour-coded readiness rating and a ranked fix plan.

Instructions scoring is tool-aware:
- `AGENTS.md` remains the preferred default.
- `CLAUDE.md` can satisfy the primary instructions check for Claude-only audits, for repos with a single clear Claude-native instruction surface, and for mirrored Claude/Cursor native setups where the selected supported tools already have native skills coverage.
- When exactly one supported tool is selected and its native skills exist, missing `.agents/skills` does not reduce the Instructions score.

## Local development

Requirements: Node.js >=20, npm.

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Type-check without emitting
npm run typecheck

# Lint
npm run lint

# Run the CLI from source (after build)
node dist/cli.js audit .
```

Or use the Makefile shortcuts — see `make help`.

## License

MIT
