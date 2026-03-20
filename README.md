# agent-harness

Audit a project for agent-readiness before giving AI coding agents broad autonomy.

Scans a repository and produces a scored report across five categories — **instructions**, **context**, **tooling**, **feedback**, and **safety** — identifying blockers and a prioritised fix plan.

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
  --tool <name>          AI tool in use: claude-code, cursor, copilot, codex, other
                         Default: other
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

# Audit a specific repo, targeting Claude Code
agent-harness audit /path/to/repo --tool claude-code

# Machine-readable output
agent-harness audit . --json --output report.json

# Write starter agent config files into the repo
agent-harness audit . --write-artifacts
```

## Scoring categories

| Category     | What it checks |
|--------------|----------------|
| instructions | AGENTS.md / CLAUDE.md presence and quality |
| context      | README, architecture docs, contributing guide |
| tooling      | Package scripts (lint, typecheck, test, build), lockfile |
| feedback     | CI workflows, test framework setup |
| safety       | .env.example, safety-level configuration |

Each category is scored 0–5. The overall score drives a colour-coded readiness rating and a ranked fix plan.

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
