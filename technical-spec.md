# agent-harness CLI — Technical Specification

Version: 2.0
Status: Approved
Author: Founding Engineer
Date: 2026-03-19

> **v2.0 changes:** Added hybrid audit model — `src/agents/` module, `--deep` flag, `--agent` flag, `fix` command, `AgentAdapter` interface, `ClaudeCodeAdapter` / `CodexAdapter` implementations, `FixEngine`, token cost display, and non-determinism handling. Heuristic path is unchanged.

---

## 1. Stack Confirmation

### Decision: Accept Proposed Stack

| Concern | Decision | Notes |
|---|---|---|
| Language | **TypeScript** | Accept. Target audience is JS/TS developers. Type safety accelerates correctness for the scoring engine. |
| Runtime | **Node.js 20+** (LTS) | Accept. v20 is the current LTS line. Use `engines: { "node": ">=20" }` in package.json to enforce. |
| Packaging | **npm bin** entry | Accept. `npx agent-harness audit .` is the zero-install path. |
| CLI parsing | **Minimal library** | Use `minimist` or hand-roll. Do NOT use `commander` or `yargs` — they add ~100KB of dep weight for a tool that has three flags. Revisit if the command surface grows beyond five subcommands. |
| Terminal output | **Hand-rolled** | No `chalk` or `ink` for V1. Node 20+ native ANSI codes are fine. Reduces install surface. |
| Test runner | **Vitest** | Accept. Fast, native TypeScript, no babel transform needed. |
| Build | **`tsc` only** | No bundler (webpack, rollup, esbuild) for V1. `tsc` to `dist/` is sufficient. Use `tsconfig.json` with `"module": "NodeNext"`. |

### Risks Flagged

1. **`minimist` parsing quirks**: it coerces `--flag=value` and bare flags differently from `commander`. Mitigate by writing a thin arg-normalizer wrapper at the CLI entrypoint and covering it with tests.
2. **`NodeNext` module resolution**: ESM-first in Node 20 means import paths need explicit `.js` extensions even for `.ts` source files. This surprises contributors. Mitigate by documenting in `CONTRIBUTING.md` and enabling `verbatimModuleSyntax` in tsconfig.
3. **npx cold start**: first `npx agent-harness` invocation downloads and unpacks the package. Keep total package size under 50KB (compressed) to stay under 200ms cold start. Enforce with a `size-limit` check in CI.
4. **Agent CLI stability**: `claude` and `codex` CLIs are actively evolving. Isolate all adapter logic in `src/agents/` behind the `AgentAdapter` interface so breaking changes are contained.
5. **Non-determinism in deep mode**: two `--deep` runs on the same repo may return different findings. Mitigation: surface a non-determinism disclaimer in the terminal report header for deep audits; document in README.

---

## 2. Module Interfaces

### 2.1 Directory Layout

```
src/
  cli.ts                  # entrypoint: parse args, route to command
  commands/
    audit.ts              # orchestrate audit command
    fix.ts                # orchestrate fix command (V1)
  inspection/
    local.ts              # filesystem evidence collector
    package.ts            # package.json + lockfile parser
  agents/
    index.ts              # agent discovery + adapter registry
    adapter.ts            # AgentAdapter interface
    claude-code.ts        # ClaudeCodeAdapter implementation
    codex.ts              # CodexAdapter implementation
  scoring/
    index.ts              # score orchestrator
    categories/
      instructions.ts
      context.ts
      tooling.ts
      feedback.ts
      safety.ts
  fix/
    engine.ts             # FixEngine: proposes and applies fixes interactively
  artifacts/
    generate.ts           # artifact writer
    templates/
      agents.md.template
      validation-checklist.md.template
      architecture-outline.md.template
  reporters/
    text.ts               # terminal output
    json.ts               # structured output
  types.ts                # all shared types (single source of truth)
tests/
  inspection/
    local.test.ts
    package.test.ts
  agents/
    index.test.ts
    claude-code.test.ts
    codex.test.ts
  scoring/
    instructions.test.ts
    context.test.ts
    tooling.test.ts
    feedback.test.ts
    safety.test.ts
    index.test.ts
  reporters/
    text.test.ts
    json.test.ts
  artifacts/
    generate.test.ts
  fix/
    engine.test.ts
fixtures/
  minimal/                # package.json only, no tests, no docs
  partial/                # has README + tests, no agent files
  strong/                 # near-ideal setup
  ts-webapp/              # realistic Next.js app skeleton
```

### 2.2 Type Definitions (`src/types.ts`)

```typescript
// Input

export type AgentTool = "claude-code" | "cursor" | "copilot" | "codex" | "other";
export type SafetyLevel = "low" | "medium" | "high";
export type AgentName = "claude-code" | "codex";  // supported deep-audit agents

export interface AuditInput {
  path: string;            // absolute resolved path
  tool: AgentTool;         // default: "other"
  failureMode?: string;    // optional user-supplied context
  safetyLevel: SafetyLevel; // default: "medium"
  jsonMode: boolean;       // --json flag
  writeArtifacts: boolean; // --write-artifacts flag
  outputFile?: string;     // --output flag
  deep: boolean;           // --deep flag: route through agent adapter
  agentName?: AgentName;   // --agent flag: explicit agent selection
  tokens: boolean;         // --tokens flag: display token counts instead of dollar cost
  verbose: boolean;        // --verbose flag: show full file previews in fix mode (no truncation)
  debug: boolean;          // --debug flag: print stack traces and verbose error info to stderr
  noColor: boolean;        // --no-color flag: disable ANSI color codes
}

// Evidence

export interface FileSignals {
  hasAgentsMd: boolean;
  hasCLAUDEMd: boolean;
  hasReadme: boolean;
  hasContributing: boolean;
  hasArchitectureDocs: boolean;       // ARCHITECTURE.md or docs/architecture.*
  hasEnvExample: boolean;
  hasDocsDir: boolean;
}

export interface PackageSignals {
  hasPackageJson: boolean;
  hasLockfile: boolean;               // any of npm/pnpm/yarn
  lockfileType?: "npm" | "pnpm" | "yarn";
  scripts: {
    hasLint: boolean;
    hasTypecheck: boolean;
    hasTest: boolean;
    hasBuild: boolean;
  };
}

export interface TestSignals {
  hasTestDir: boolean;                // tests/, test/, __tests__
  hasTestFiles: boolean;              // *.test.* or *.spec.* at root
  testFramework?: "vitest" | "jest" | "playwright" | "unknown";
  hasVitestConfig: boolean;
  hasJestConfig: boolean;
  hasPlaywrightConfig: boolean;
}

export interface WorkflowSignals {
  hasCIWorkflows: boolean;            // .github/workflows/*.yml
  workflowCount: number;
}

export interface ContextSignals {
  hasTsConfig: boolean;
  detectedLanguage: "typescript" | "javascript" | "unknown";
  detectedFramework?: "next" | "remix" | "vite" | "react" | "other";
  hasEslintConfig: boolean;
}

export interface RepoEvidence {
  files: FileSignals;
  packages: PackageSignals;
  tests: TestSignals;
  workflows: WorkflowSignals;
  context: ContextSignals;
}

// Agent Adapter

export interface AgentDiscoveryResult {
  available: AgentName[];   // agents found in PATH
  selected?: AgentName;     // which one was selected (auto or explicit)
}

export interface DeepAuditFinding {
  categoryId: CategoryId;
  checkId: string;
  passed: boolean;
  label: string;
  evidence: string;          // agent-provided justification (repo-specific)
  failureNote?: string;
}

export interface DeepAuditResult {
  agentName: AgentName;
  findings: DeepAuditFinding[];
  tokenEstimate: number;     // estimated tokens before run (best effort)
  tokensActual: number;      // actual tokens consumed (from agent response)
  costEstimateUsd: number;   // estimated cost in USD before run
  costActualUsd: number;     // actual cost in USD (from agent response)
  durationMs: number;
  rawResponse?: string;      // raw agent output, included in JSON mode only
}

// Scoring

export type CategoryId = "instructions" | "context" | "tooling" | "feedback" | "safety";

export interface CheckResult {
  id: string;             // e.g. "has_agents_md"
  passed: boolean;
  weight: number;         // contribution to category score
  label: string;          // human-readable check name
  failureNote?: string;   // shown only when !passed
  evidence?: string;      // repo-specific evidence (deep mode only)
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;          // 0–5, one decimal place allowed
  maxScore: 5;
  checks: CheckResult[];
  failingChecks: CheckResult[];  // derived: checks where !passed
}

export interface Blocker {
  categoryId: CategoryId;
  checkId: string;
  title: string;
  why: string;
  likelyFailureMode: string;
  effort: "quick" | "medium" | "heavy";
}

export interface FixItem {
  categoryId: CategoryId;
  checkId: string;
  action: string;
  effort: "quick" | "medium" | "heavy";
  priority: number;       // lower = higher priority
}

export interface ScoringResult {
  overallScore: number;   // 0–100
  categoryScores: CategoryScore[];
  topBlockers: Blocker[]; // top 3, ranked by impact
  fixPlan: FixItem[];     // full prioritized list
}

// Fix Command

export interface FixProposal {
  id: string;             // stable identifier for this proposal
  checkId: string;
  title: string;
  description: string;    // what will be done
  previewLines: string[]; // summary of content or diff (shown on preview)
  targetPath?: string;    // file to be created/modified, if applicable
  content?: string;       // full proposed content for new files
}

export type FixDecision = "accept" | "reject" | "preview";

export interface FixResult {
  proposalId: string;
  decision: FixDecision;
  applied: boolean;
  error?: string;
}

// Artifacts

export interface ArtifactResult {
  id: "agents" | "validation-checklist" | "architecture-outline";
  filename: string;        // e.g. "AGENTS.generated.md"
  targetPath: string;      // absolute path where it would be written
  skipped: boolean;        // true if file already exists
  written: boolean;
  content: string;         // always populated even if not written
}

// Report

export interface AuditReport {
  version: "1";            // schema version, always literal "1" for V1
  generatedAt: string;     // ISO 8601 UTC
  input: AuditInput;
  evidence: RepoEvidence;
  scoring: ScoringResult;
  artifacts: ArtifactResult[];
  deepAudit?: DeepAuditResult;  // present only when input.deep === true
}
```

### 2.3 CLI Entrypoint (`src/cli.ts`)

**Responsibility**: parse raw `process.argv`, build `AuditInput`, delegate to command module. No business logic here.

```typescript
parseArgs(argv: string[]): AuditInput
main(): Promise<void>  // process.exit on error, exit 0 on success
```

New flags handled by `parseArgs`:

| Flag | Type | Default | Description |
|---|---|---|---|
| `--deep` | boolean | `false` | Route audit through agent adapter instead of heuristics only |
| `--agent <name>` | string | auto | Explicit agent selection: `claude-code` or `codex` |
| `--tokens` | boolean | `false` | Display token counts instead of dollar cost (used with `--deep`) |
| `--verbose` | boolean | `false` | Show full file content in previews in `fix` mode (no truncation) |
| `--debug` | boolean | `false` | Print stack traces and verbose error info to stderr |
| `--no-color` | boolean | `false` | Disable ANSI color codes in all output |

Exit codes:
- `0` — success
- `1` — audit ran but scored below threshold (only if `--fail-under` is added later; not in V1)
- `2` — invalid arguments, unsupported path, or `--deep` with no agent available
- `3` — unexpected internal error

### 2.4 Audit Command (`src/commands/audit.ts`)

**Responsibility**: orchestrate the audit pipeline in order. Supports both heuristic (default) and deep (agent-delegated) paths.

```typescript
export async function runAudit(input: AuditInput): Promise<AuditReport>
```

Internal pipeline — **heuristic path** (default):
1. Validate `input.path` exists and is a directory
2. `collectEvidence(input.path)` → `RepoEvidence`
3. `scoreProject(evidence, input)` → `ScoringResult`
4. `buildReport(input, evidence, scoring)` → `AuditReport`
5. Return report

Internal pipeline — **deep path** (`--deep`):
1. Validate `input.path` exists and is a directory
2. `discoverAgents()` → `AgentDiscoveryResult`; exit `2` if none available and no `--agent` specified
3. `collectEvidence(input.path)` → `RepoEvidence` (heuristic layer still runs)
4. `invokeDeepAudit(selectedAgent, input)` → `DeepAuditResult`
5. `mergeDeepFindings(evidence, deepResult)` → enriched `RepoEvidence` (agent findings override heuristic where present)
6. `scoreProject(mergedEvidence, input)` → `ScoringResult`
7. `buildReport(input, evidence, scoring, deepResult)` → `AuditReport` (includes `deepAudit` field)
8. Return report

Both paths produce the same `AuditReport` shape. The `deepAudit` field is populated only in deep mode. Reporter output format is identical regardless of path.

### 2.5 Inspection Modules

**`src/inspection/local.ts`**

```typescript
export async function collectEvidence(projectPath: string): Promise<RepoEvidence>
```

Uses `fs/promises` only. No shell exec. Resolves all checks by testing file/directory existence and reading files when needed. Maximum 100ms for any project under 10k files.

**`src/inspection/package.ts`**

```typescript
export async function parsePackageSignals(projectPath: string): Promise<PackageSignals>
```

Reads and parses `package.json` safely (try/catch). Checks for lockfile presence via `existsSync`. Does not install or exec npm.

### 2.6 Agent Discovery (`src/agents/index.ts`)

**Responsibility**: detect which supported coding agents are installed in PATH and select one for use.

```typescript
export async function discoverAgents(): Promise<AgentDiscoveryResult>

export function selectAgent(
  discovery: AgentDiscoveryResult,
  requested?: AgentName
): AgentName | null
```

Detection strategy:
- For each supported agent, run its version command with a 2-second timeout: `claude --version`, `codex --version`
- If the command exits 0, the agent is available
- Shell exec is only used here (not in inspection or scoring)
- Detection order determines auto-select priority: `claude-code` first, then `codex`

```typescript
// Detection probes
const AGENT_PROBES: Record<AgentName, string[]> = {
  "claude-code": ["claude", "--version"],
  "codex": ["codex", "--version"],
};
```

If `--agent <name>` is specified but that agent is not found, exit with code `2` and a clear error message.

### 2.7 Agent Adapter Interface (`src/agents/adapter.ts`)

```typescript
export interface AgentAdapter {
  /** Human-readable name for display */
  name: AgentName;

  /** Check if this agent is available in the environment */
  detect(): Promise<boolean>;

  /**
   * Invoke the agent to perform a deep audit of the repo.
   * Returns structured findings + metadata.
   */
  invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult>;
}
```

Contract:
- `detect()` must complete within 2 seconds. Timeout = unavailable.
- `invoke()` may take 10–60 seconds. Show a spinner in the terminal.
- `invoke()` must return a valid `DeepAuditResult` or throw. Never hang silently.
- The adapter is responsible for building the prompt, invoking the CLI, parsing the response, and estimating token cost.

### 2.8 ClaudeCodeAdapter (`src/agents/claude-code.ts`)

```typescript
export class ClaudeCodeAdapter implements AgentAdapter {
  name: AgentName = "claude-code";
  detect(): Promise<boolean>
  invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult>
}
```

Invocation strategy:
- Build a structured audit prompt from the rubric categories and the pre-collected `RepoEvidence`
- Invoke `claude` CLI with `--output-format json` and `--max-turns 1` to get a single structured response
- Parse the JSON response into `DeepAuditFinding[]`
- Estimate token cost from response metadata if available; otherwise use character-count heuristic (1 token ≈ 4 chars)

Prompt structure (sent to `claude`):
```
You are auditing a software repository for AI coding agent readiness.
Repo path: {projectPath}

Pre-collected signals (heuristic layer):
{JSON.stringify(evidence)}

For each of the following check IDs, determine pass/fail and provide
a one-sentence repo-specific evidence string:
{checkIds}

Respond ONLY with a JSON array of findings:
[{ "checkId": "...", "passed": boolean, "evidence": "..." }]
```

### 2.9 CodexAdapter (`src/agents/codex.ts`)

```typescript
export class CodexAdapter implements AgentAdapter {
  name: AgentName = "codex";
  detect(): Promise<boolean>
  invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult>
}
```

Invocation strategy mirrors `ClaudeCodeAdapter`. The prompt is identical; only the CLI invocation differs:
- Invoke `codex` with `--json` flag (or equivalent for structured output)
- If Codex does not support `--json`, capture stdout and parse the first JSON block

### 2.10 Scoring Engine (`src/scoring/index.ts`)

**Unchanged interface**. The scoring engine is path-agnostic — it receives `RepoEvidence` and returns `ScoringResult` regardless of whether evidence was collected heuristically or merged from a deep audit.

```typescript
export function scoreProject(evidence: RepoEvidence, input: AuditInput): ScoringResult
```

When `input.deep === true` and `DeepAuditFinding` values are merged into evidence, the same scoring formulas apply. Agent findings can only upgrade a check from `false` to `true`, not downgrade (trust but verify: heuristic passing checks are not overridden by agent).

**`src/scoring/categories/` — interface unchanged:**

```typescript
export function scoreInstructions(evidence: RepoEvidence): CategoryScore
export function scoreContext(evidence: RepoEvidence): CategoryScore
export function scoreTooling(evidence: RepoEvidence): CategoryScore
export function scoreFeedback(evidence: RepoEvidence): CategoryScore
export function scoreSafety(evidence: RepoEvidence): CategoryScore
```

Each function is pure and deterministic — same input always produces same output.

### 2.11 Fix Command (`src/commands/fix.ts`)

**Responsibility**: orchestrate the interactive fix workflow. Requires `--deep` implicitly — fix proposals are agent-generated and repo-specific.

```typescript
export async function runFix(input: AuditInput): Promise<void>
```

Pipeline:
1. Run full deep audit (same as `runAudit` with `deep: true`)
2. Pass `ScoringResult` and `DeepAuditResult` to `FixEngine.propose()` → `FixProposal[]`
3. Present each proposal interactively (see UX in Section 10)
4. For each user decision: call `FixEngine.apply(proposal, decision)`
5. Print summary of accepted/rejected fixes

**`fix . --json` mode**: When `input.jsonMode === true`, skip interactive presentation entirely. Output the fix plan as structured JSON to stdout (exit code 2) and apply nothing. Schema:

```json
{
  "version": "1",
  "generatedAt": "<ISO 8601 timestamp>",
  "command": "fix",
  "agentName": "<agent name>",
  "tokenEstimate": 17621,
  "tokensActual": 17500,
  "costEstimateUsd": 0.05,
  "costActualUsd": 0.048,
  "fixes": [
    {
      "id": "<checkId>",
      "categoryId": "<category>",
      "effort": "quick | medium | heavy",
      "targetPath": "<absolute path>",
      "action": "create | edit | delete",
      "content": "<full file content or edit diff>"
    }
  ]
}
```

The `fixes` array follows the same `FixProposal` shape used internally. All other top-level fields match the `audit . --json` base schema (see Section 2.13). No human-readable output is emitted in `--json` mode.

### 2.12 Fix Engine (`src/fix/engine.ts`)

```typescript
export class FixEngine {
  /**
   * Generate fix proposals from audit results.
   * Proposals are agent-generated (repo-specific content), not templates.
   */
  propose(
    report: AuditReport,
    deepResult: DeepAuditResult
  ): Promise<FixProposal[]>

  /**
   * Apply a single fix proposal to the filesystem.
   */
  apply(proposal: FixProposal, decision: FixDecision): Promise<FixResult>
}
```

`propose()` calls the agent a second time with a focused prompt:
```
Given these failing checks: {failingChecks}
And this repo evidence: {evidence}

For each failing check, propose a specific fix. For file-creation fixes,
provide the full file content (not a template). For script fixes, provide
the exact edit.

Respond ONLY with a JSON array of proposals:
[{ "checkId": "...", "title": "...", "description": "...", "targetPath": "...", "content": "..." }]
```

`apply()` writes the file or makes the edit. Does not exec npm or run any commands. File writes use `fs/promises.writeFile` with the same overwrite guard as artifact generation.

### 2.13 Reporters

**`src/reporters/text.ts`**

```typescript
export function renderTextReport(report: AuditReport): string
```

Returns a string; caller writes to stdout. This makes it unit-testable without stdout mocking.

When `report.input.deep === true`, prepend a non-determinism notice:
```
⚠  Deep audit — results may vary between runs. Agent: claude-code. Est. tokens: ~1,240.
```

**`src/reporters/json.ts`**

```typescript
export function renderJsonReport(report: AuditReport): string
```

Returns `JSON.stringify(report, null, 2)`. The `AuditReport` type IS the JSON schema.

### 2.14 Artifact Generator

**`src/artifacts/generate.ts`** — unchanged interface.

```typescript
export async function generateArtifacts(
  report: AuditReport,
  projectPath: string,
  write: boolean
): Promise<ArtifactResult[]>
```

Always returns populated `ArtifactResult[]` with `content` set, regardless of `write`. When `write=false`, `written=false` for all. When `write=true`, writes each file unless `skipped=true` (target already exists).

---

## 3. Scoring Rubric Implementation

### 3.1 Instructions (weight: 0.25)

| Check ID | Label | Weight | Pass Condition |
|---|---|---|---|
| `has_agents_md` | AGENTS.md present | 0.35 | `files.hasAgentsMd` |
| `has_claude_md` | CLAUDE.md present | 0.25 | `files.hasCLAUDEMd` |
| `has_readme` | README present | 0.25 | `files.hasReadme` |
| `has_contributing` | CONTRIBUTING.md present | 0.15 | `files.hasContributing` |

Score: `sum(passing check weights) / sum(all weights) * 5`

Failure notes:
- `has_agents_md`: "No AGENTS.md found. This is the primary way to give agent-specific operating instructions."
- `has_claude_md`: "No CLAUDE.md found. Claude Code reads this for project-level constraints."
- `has_readme`: "No README found. Agents use this to orient before exploring the codebase."
- `has_contributing`: "No CONTRIBUTING.md found. Agents may not know the contribution model."

### 3.2 Context (weight: 0.20)

| Check ID | Label | Weight | Pass Condition |
|---|---|---|---|
| `has_architecture_docs` | Architecture docs exist | 0.35 | `files.hasArchitectureDocs` |
| `has_docs_dir` | docs/ directory exists | 0.25 | `files.hasDocsDir` |
| `has_tsconfig` | tsconfig.json present | 0.25 | `context.hasTsConfig` |
| `has_env_example` | .env.example present | 0.15 | `files.hasEnvExample` |

### 3.3 Tooling (weight: 0.20)

| Check ID | Label | Weight | Pass Condition |
|---|---|---|---|
| `has_package_json` | package.json present | 0.20 | `packages.hasPackageJson` |
| `has_lockfile` | Lockfile present | 0.20 | `packages.hasLockfile` |
| `has_lint_script` | lint script present | 0.20 | `packages.scripts.hasLint` |
| `has_typecheck_script` | typecheck script present | 0.20 | `packages.scripts.hasTypecheck` |
| `has_build_script` | build script present | 0.20 | `packages.scripts.hasBuild` |

### 3.4 Feedback (weight: 0.25)

| Check ID | Label | Weight | Pass Condition |
|---|---|---|---|
| `has_test_script` | test script present | 0.25 | `packages.scripts.hasTest` |
| `has_test_dir` | test directory exists | 0.30 | `tests.hasTestDir` |
| `has_test_files` | test files present | 0.15 | `tests.hasTestFiles` |
| `has_ci_workflows` | CI workflows present | 0.30 | `workflows.hasCIWorkflows` |

### 3.5 Safety (weight: 0.10)

| Check ID | Label | Weight | Pass Condition |
|---|---|---|---|
| `has_env_example` | Environment vars documented | 0.40 | `files.hasEnvExample` |
| `has_contributing` | Contribution process documented | 0.30 | `files.hasContributing` |
| `has_architecture_docs` | Architecture guidance exists | 0.30 | `files.hasArchitectureDocs` |

Note: `has_env_example` and `has_contributing` appear in multiple categories intentionally. They address different failure modes in each context.

### 3.6 Blocker Selection

After scoring, derive `topBlockers`:
1. Collect all `failingChecks` across all categories
2. Sort by `(categoryWeight * checkWeight)` descending
3. Map top 3 to `Blocker` objects with pre-authored `why` and `likelyFailureMode` strings
4. If fewer than 3 checks fail, return however many failed

### 3.7 Fix Plan

Map all failing checks to `FixItem` with effort estimates:

| Check | Effort |
|---|---|
| `has_agents_md` | quick (15 min) |
| `has_claude_md` | quick (10 min) |
| `has_readme` | medium (1–2 hrs) |
| `has_contributing` | medium (30 min) |
| `has_architecture_docs` | heavy (2–4 hrs) |
| `has_docs_dir` | medium (varies) |
| `has_tsconfig` | quick (5 min) |
| `has_env_example` | quick (10 min) |
| `has_package_json` | quick (5 min, scaffolded) |
| `has_lockfile` | quick (run npm install) |
| `has_lint_script` | medium (eslint setup) |
| `has_typecheck_script` | quick (add to package.json) |
| `has_build_script` | quick (add to package.json) |
| `has_test_script` | medium (add script + config) |
| `has_test_dir` | medium (add test dir + first test) |
| `has_test_files` | medium (add test files) |
| `has_ci_workflows` | medium (GitHub Actions setup) |

---

## 4. JSON Output Schema

The JSON output IS the `AuditReport` type serialized. This section documents the stable V1 schema.

```json
{
  "version": "1",
  "generatedAt": "2026-03-18T22:00:00.000Z",
  "input": {
    "path": "/abs/path/to/project",
    "tool": "claude-code",
    "failureMode": "regressions after edits",
    "safetyLevel": "medium",
    "jsonMode": true,
    "writeArtifacts": false,
    "deep": true,
    "agentName": "claude-code"
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
      "lockfileType": "npm",
      "scripts": {
        "hasLint": true,
        "hasTypecheck": false,
        "hasTest": true,
        "hasBuild": true
      }
    },
    "tests": {
      "hasTestDir": true,
      "hasTestFiles": false,
      "testFramework": "vitest",
      "hasVitestConfig": true,
      "hasJestConfig": false,
      "hasPlaywrightConfig": false
    },
    "workflows": {
      "hasCIWorkflows": true,
      "workflowCount": 2
    },
    "context": {
      "hasTsConfig": true,
      "detectedLanguage": "typescript",
      "detectedFramework": "next",
      "hasEslintConfig": true
    }
  },
  "scoring": {
    "overallScore": 62,
    "categoryScores": [
      {
        "id": "instructions",
        "label": "Instructions",
        "score": 2.5,
        "maxScore": 5,
        "checks": [...],
        "failingChecks": [...]
      }
    ],
    "topBlockers": [
      {
        "categoryId": "instructions",
        "checkId": "has_agents_md",
        "title": "No agent instructions file found",
        "why": "Without AGENTS.md or CLAUDE.md, the agent starts every session with no project-specific context.",
        "likelyFailureMode": "Agent makes incorrect assumptions about structure, scope, or constraints.",
        "effort": "quick"
      }
    ],
    "fixPlan": [...]
  },
  "artifacts": [
    {
      "id": "agents",
      "filename": "AGENTS.generated.md",
      "targetPath": "/abs/path/to/project/AGENTS.generated.md",
      "skipped": false,
      "written": false,
      "content": "# Agent Instructions\n..."
    }
  ],
  "deepAudit": {
    "agentName": "claude-code",
    "findings": [
      {
        "categoryId": "instructions",
        "checkId": "has_agents_md",
        "passed": false,
        "label": "AGENTS.md present",
        "evidence": "No AGENTS.md or CLAUDE.md found. The repo has a README that references Claude Code but provides no operating constraints for the agent."
      }
    ],
    "tokenEstimate": 1240,
    "tokensActual": 1180,
    "costEstimateUsd": 0.004,
    "costActualUsd": 0.0038,
    "durationMs": 14320
  }
}
```

**Schema stability guarantees for V1:**
- `version` field will be `"1"` for all V1 releases. Consumers MUST check this field.
- Top-level keys (`version`, `generatedAt`, `input`, `evidence`, `scoring`, `artifacts`) will not be removed in V1.
- `deepAudit` is optional — absent when `input.deep === false`.
- `categoryScores` array order is stable: always `["instructions", "context", "tooling", "feedback", "safety"]`.
- `overallScore` is always an integer 0–100.
- `categoryScores[].score` is always a number with at most one decimal place, 0–5.
- Breaking schema changes require a `version` bump to `"2"`.

---

## 5. Artifact Generation

### 5.1 Templates

Templates live in `src/artifacts/templates/` as `.template` files. They are embedded at build time (copied to `dist/`). They use simple `{{TOKEN}}` substitution only — no template engine dependency.

Available tokens: `{{PROJECT_NAME}}`, `{{DETECTED_LANGUAGE}}`, `{{DETECTED_FRAMEWORK}}`, `{{GENERATED_DATE}}`

### 5.2 Artifact IDs and Filenames

| ID | Output Filename | Template |
|---|---|---|
| `agents` | `AGENTS.generated.md` | `agents.md.template` |
| `validation-checklist` | `validation-checklist.generated.md` | `validation-checklist.md.template` |
| `architecture-outline` | `architecture-outline.generated.md` | `architecture-outline.md.template` |

### 5.3 Overwrite Guard Rules

1. Before writing any file, check if it exists using `fs.existsSync(targetPath)`.
2. If it exists, set `skipped: true, written: false`. Log a warning to stderr.
3. The guard applies to both the generated filename (e.g. `AGENTS.generated.md`) **and** the canonical filename (e.g. `AGENTS.md`). If `AGENTS.md` exists, do NOT write `AGENTS.generated.md` either — the user has a live instructions file.
4. There is no `--force` flag in V1. Force-overwrite is explicitly out of scope.

### 5.4 Dry-Run Preview

When `--json` is set without `--write-artifacts`, the `artifacts` array in the JSON output still contains all artifacts with full `content`, so users can preview what would be written before committing.

---

## 6. Ambiguities Requiring Product Decisions

### A. `--tool` flag behavior — does it change scoring weights?

**Board decision (2026-03-18): YES — tool flag adjusts scoring weights.**

Implementation: when `tool=claude-code`, boost `has_claude_md` check weight in the Instructions category from 0.25 to 0.40 (redistribute from `has_contributing`). When `tool=cursor`, no weight changes in V1 (cursor-specific checks are V2 scope). Other tools: no weight changes.

### B. Minimum score threshold — does the CLI exit non-zero on low scores?

**Board decision (2026-03-18): NO — exit `0` for all completed audits in V1.**

Exit codes remain: `0` success, `2` invalid args/path/no agent available, `3` internal error. No score-based exit codes in V1.

### C. Framework detection depth

**My recommendation**: Shallow only in V1. Check `package.json` dependencies for `next`, `remix`, `vite`, `react`. No filesystem-level framework detection. Label it `"other"` if none match. Framework is metadata for context, not used in scoring V1.

**Decision needed from**: Engineering judgment — flagging for awareness only. I'll implement shallow detection unless directed otherwise.

### D. `--safety-level` flag effect

**Board decision (2026-03-18): Metadata only in V1.**

`--safety-level` value is stored in `AuditInput`, included in JSON output and text report header. No effect on scoring weights or check selection in V1.

### E. `--failure-mode` text — does it affect output?

**My recommendation**: Store in `AuditInput`, include in JSON output and text report header. No effect on scoring or check selection in V1. The value will be visible in the report for context.

**Decision needed from**: None — proceeding with metadata-only unless directed otherwise.

### F. Artifact content quality

**Board decision (2026-03-18): Engineering judgment — proceed.**

Template content decisions are owned by engineering. Each template will be a minimal, opinionated starting point with clear placeholders. Under 100 lines each. Templates defined below in Section 9.

### G. Deep mode: agent timeout

**My recommendation**: 60-second hard timeout for `invoke()`. If the agent does not respond within 60 seconds, exit `2` with a clear error. Do not silently fall back to heuristic — the user explicitly requested deep mode.

**Decision needed from**: None — proceeding with 60s timeout unless directed otherwise.

### H. Fix command: agent re-invocation cost

The `fix` command invokes the agent twice (once for audit, once for proposals). This doubles token cost. Users should be warned before proceeding.

**My recommendation**: Before the second invocation, print:
```
ℹ  Generating repo-specific fix proposals (second agent call)...
   Est. additional cost: ~{N} tokens. Continue? [y/n]
```

**Decision needed from**: None — proceeding with confirmation prompt unless directed otherwise.

---

## 7. Engineering Effort Estimates

### Task 1: Lock product and technical constraints
**Effort**: 0.5 days
Already done via this spec.

### Task 2: Scaffold CLI project
**Effort**: 0.5 days
- Initialize TypeScript project, configure `tsconfig.json` for NodeNext
- Set up `package.json` with `bin` entry
- Configure Vitest
- Wire `agent-harness --help`, stub `audit` and `fix` commands
- Set up `tsc` build script and `.npmignore`

### Task 3: Implement local repo inspection
**Effort**: 1 day
- Implement `local.ts` with all `FileSignals`, `TestSignals`, `WorkflowSignals`, `ContextSignals`
- Implement `package.ts` with `PackageSignals`
- Create 4 fixture repos (minimal, partial, strong, ts-webapp)
- Write unit tests for all evidence collectors

### Task 4: Implement scoring engine
**Effort**: 1 day
- Implement 5 category scorers
- Implement `scoring/index.ts` orchestrator
- Implement blocker selection and fix plan generation
- Write unit tests for all scoring paths (pass/fail combos on fixtures)

### Task 5: Implement terminal reporter
**Effort**: 0.5 days
- Implement `text.ts` renderer (including deep-mode notice header)
- Test output width at 80 and 120 chars
- Write snapshot tests for terminal output

### Task 6: Add JSON output
**Effort**: 0.5 days
- Implement `json.ts` (trivial — JSON.stringify of typed report)
- Test that schema matches documented spec
- Handle `--output` file writing
- Test round-trip: write JSON, read back, validate shape

### Task 7: Add starter artifact generation
**Effort**: 1 day
- Write 3 templates
- Implement `generate.ts` with token substitution and overwrite guard
- Write tests for all guard scenarios (file exists, file missing, canonical file exists)
- Board review of template content

### Task 8: Implement agent adapters
**Effort**: 1.5 days
- Implement `src/agents/index.ts` discovery logic with PATH probing and 2s timeout
- Implement `ClaudeCodeAdapter` with prompt builder, CLI invocation, response parser
- Implement `CodexAdapter` (mirrors ClaudeCode, different CLI flags)
- Write integration tests using fixture repos (mock CLI invocation)
- Handle timeouts and malformed responses gracefully

### Task 9: Wire deep audit path in audit command
**Effort**: 0.5 days
- Add `--deep` and `--agent` flag parsing to `cli.ts`
- Wire `discoverAgents` + `invokeDeepAudit` + `mergeDeepFindings` in `audit.ts`
- Update `text.ts` reporter to show deep-mode notice + `evidence` fields in check output
- Test deep path end-to-end with mocked adapter

### Task 10: Implement fix command
**Effort**: 2 days
- Implement `FixEngine.propose()` with agent invocation + response parsing
- Implement `FixEngine.apply()` with file write + overwrite guard
- Implement interactive terminal prompt (accept/reject/preview per proposal)
- Implement summary output after all decisions
- Write tests for engine logic (mock agent responses)

### Task 11: Add quality gates and packaging
**Effort**: 0.5 days
- Configure ESLint + `@typescript-eslint`
- Add `lint`, `typecheck`, `test` npm scripts
- Write `README.md` with install + usage docs (all three commands)
- Add `size-limit` check
- Verify `npx agent-harness audit .` and `npx agent-harness fix .` work on clean install

### Total Estimate: ~10 engineering days

Build order: Tasks 1–7 can be completed as the original heuristic MVP. Tasks 8–11 add the deep/fix layer on top. The heuristic MVP is shippable at the end of Task 7.

---

## 8. Pre-Implementation Checklist

- [x] Board approves this spec (2026-03-18, updated 2026-03-19)
- [x] Decision on `--tool` weight adjustment behavior — YES, adjust weights (Section 6A)
- [x] Decision on exit code policy — exit 0 for all audits (Section 6B)
- [x] Decision on `--safety-level` behavior — metadata only in V1 (Section 6D)
- [x] Template content — engineering judgment, see Section 9 (Section 6F)
- [x] Hybrid audit model approved — deep audit + fix command in V1 (THU-66)
- [ ] Confirm target npm package name: `agent-harness` (check npm registry for conflicts)

**Status: APPROVED. Implementation may begin.**

---

## 9. Artifact Templates

These are the starter templates for generated artifacts. Token substitution: `{{PROJECT_NAME}}`, `{{DETECTED_LANGUAGE}}`, `{{DETECTED_FRAMEWORK}}`, `{{GENERATED_DATE}}`, `{{TOOL}}`.

### 9.1 AGENTS.generated.md

```markdown
# Agent Instructions — {{PROJECT_NAME}}

Generated by agent-harness on {{GENERATED_DATE}}.
Rename to `AGENTS.md` and customize before committing.

---

## Project Overview

<!-- Describe what this project does in 2–3 sentences. -->
<!-- Example: "This is a {{DETECTED_FRAMEWORK}} app that does X." -->

## Tech Stack

- Language: {{DETECTED_LANGUAGE}}
- Framework: {{DETECTED_FRAMEWORK}}

## Operating Rules

<!-- Define what the agent is and is not allowed to do. -->
- Always run `npm test` before marking a task done
- Do not modify database schema without explicit instruction
- Ask before deleting files

## Common Tasks

<!-- Describe the most frequent tasks agents perform in this repo. -->
- To add a new feature: ...
- To fix a bug: ...
- To run the project locally: ...

## Validation Commands

```bash
npm run lint
npm run typecheck
npm test
```

## Things to Avoid

<!-- List known pitfalls in this codebase. -->
- Do not edit generated files in `dist/`
- Do not commit `.env` files

---
{{#if TOOL_IS_CLAUDE_CODE}}
## Claude Code Settings

```json
{
  "permissions": {
    "allow": ["Bash(npm run *)", "Read", "Edit", "Write"],
    "deny": ["Bash(rm -rf *)"]
  }
}
```
{{/if}}
```

### 9.2 validation-checklist.generated.md

```markdown
# Validation Checklist — {{PROJECT_NAME}}

Generated by agent-harness on {{GENERATED_DATE}}.
Use this checklist before merging agent-assisted changes.

---

## Before Every Merge

- [ ] `npm run lint` passes with no errors
- [ ] `npm run typecheck` passes (if applicable)
- [ ] `npm test` passes (all tests green)
- [ ] No hardcoded credentials or secrets added
- [ ] No console.log / debug statements left in production code
- [ ] Changed files reviewed manually (not just AI-generated output)

## Before Deploying

- [ ] `.env.example` updated if new environment variables were added
- [ ] Database migrations tested locally (if applicable)
- [ ] Feature works on mobile viewport (if UI change)
- [ ] No new dependencies added without review

## Regression Checks

<!-- Add project-specific checks here. -->
- [ ] Core user flow works end-to-end
- [ ] ...
```

### 9.3 architecture-outline.generated.md

```markdown
# Architecture Outline — {{PROJECT_NAME}}

Generated by agent-harness on {{GENERATED_DATE}}.
Fill in the sections below and commit as `ARCHITECTURE.md` or `docs/architecture.md`.

---

## What This Is

<!-- 2–3 sentences: what the system does and who uses it. -->

## Tech Stack

- Language: {{DETECTED_LANGUAGE}}
- Framework: {{DETECTED_FRAMEWORK}}
- Database: <!-- e.g. PostgreSQL, SQLite, none -->
- Hosting: <!-- e.g. Vercel, Railway, self-hosted -->

## Directory Structure

```
<!-- Paste the output of `ls -la` or `tree -L 2` here -->
```

## Key Files

| File/Dir | Purpose |
|---|---|
| <!-- path --> | <!-- what it does --> |

## Data Flow

<!-- Describe the main request/response cycle. -->
1. User does X
2. System calls Y
3. Result is Z

## External Dependencies

<!-- List any external APIs, services, or integrations. -->
- <!-- Service: what it does, which env var holds the key -->

## Known Constraints

<!-- Anything an agent must know to avoid breaking things. -->
- ...
```

Note: The `{{#if TOOL_IS_CLAUDE_CODE}}` block in the AGENTS template is a conditional — implement in `generate.ts` as a simple string check on `input.tool`, not a full template engine.

---

## 10. Fix Command UX (Terminal)

This section specifies the exact terminal interaction for `agent-harness fix .`.

```
$ agent-harness fix .

Analyzing repo with claude-code...  ████████████████  14.3s

Found 4 fixable issues:

  1. Missing AGENTS.md
     → Will create AGENTS.md with project-specific operating instructions
       (Agent read src/ and identified 3 key constraints)
     Apply? [y/n/p for preview]  y
     ✓ Written: AGENTS.md

  2. No test command in package.json
     → Add "test": "vitest run" to scripts (detected vitest in devDependencies)
     Apply? [y/n/p for preview]  p

     Preview:
     ─────────────────────────────────────────
      "scripts": {
        "lint": "eslint src",
     +  "test": "vitest run",
        "build": "tsc"
      }
     ─────────────────────────────────────────
     Apply? [y/n]  y
     ✓ Written: package.json

  3. Missing .env.example
     → Generated from detected env vars in src/config.ts (DATABASE_URL, API_KEY)
     Apply? [y/n/p for preview]  n
     ✗ Skipped

  4. No architecture documentation
     → Will create ARCHITECTURE.md from codebase analysis
     Apply? [y/n/p for preview]  y
     ✓ Written: ARCHITECTURE.md

Summary: 3 applied, 1 skipped. Est. tokens used: ~2,480.
```

Rules:
- Present proposals in order of fix-plan priority (same ordering as `fixPlan` in scoring)
- Preview shows a diff-style block (lines added with `+`, removed with `-`) for edits; full content for new files (first 30 lines, then `... N more lines`)
- After preview, re-prompt `Apply? [y/n]` (no preview option again)
- After all proposals are processed, print the summary line
- Token estimate covers both audit + proposal invocations combined
