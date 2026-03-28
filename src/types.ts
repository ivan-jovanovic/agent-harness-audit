// Errors

/** Thrown for invalid arguments or bad input paths — CLI exits with code 2. */
export class AuditUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditUsageError";
  }
}

// Input

export type TargetTool = "claude-code" | "cursor" | "copilot" | "codex" | "other";
export type SafetyLevel = "low" | "medium" | "high";
export type AgentName = "claude-code" | "codex";
export type ToolsRequested = "all" | TargetTool[];

export interface AuditInput {
  path: string;
  toolsRequested: ToolsRequested;
  toolsResolved: TargetTool[];
  failureMode?: string;
  safetyLevel: SafetyLevel;
  jsonMode: boolean;
  writeArtifacts: boolean;
  outputFile?: string;
  deep: boolean;
  agentName?: AgentName;
  tokens: boolean;
  verbose: boolean;
  debug: boolean;
  noColor: boolean;
}

// Evidence

export interface FileSignals {
  hasAgentsMd: boolean;
  hasCLAUDEMd: boolean;
  hasReadme: boolean;
  hasGenericSkills: boolean;
  hasClaudeSkills: boolean;
  hasCursorSkills: boolean;
  hasArchitectureDocs: boolean;
  hasEnvExample: boolean;
  hasDocsDir: boolean;
  hasDocsIndex: boolean;
}

export interface PackageSignals {
  hasPackageJson: boolean;
  hasLockfile: boolean;
  lockfileType?: "npm" | "pnpm" | "yarn";
  scripts: {
    hasLint: boolean;
    hasTypecheck: boolean;
    hasTest: boolean;
    hasBuild: boolean;
  };
  warnings: string[];
}

export interface TestSignals {
  hasTestDir: boolean;
  hasTestFiles: boolean;
  testFramework?: "vitest" | "jest" | "playwright" | "unknown";
  hasVitestConfig: boolean;
  hasJestConfig: boolean;
  hasPlaywrightConfig: boolean;
}

export interface WorkflowSignals {
  hasCIWorkflows: boolean;
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
  warnings: string[];
}

// Agent discovery / deep audit

export interface AgentDiscoveryResult {
  available: AgentName[];
  selected?: AgentName;
}

export interface DeepAuditFinding {
  categoryId: CategoryId;
  checkId: string;
  passed: boolean;
  label: string;
  evidence: string;
  failureNote?: string;
}

export interface DeepAuditResult {
  agentName: AgentName;
  findings: DeepAuditFinding[];
  tokenEstimate: number;
  tokensActual: number;
  costEstimateUsd: number;
  costActualUsd: number;
  durationMs: number;
  rawResponse?: string;
}

// Scoring

export type CategoryId = "instructions" | "context" | "tooling" | "feedback" | "safety";
export type DeepCheckOverrides = Record<string, boolean>;

export interface CheckResult {
  id: string;
  passed: boolean;
  weight: number;
  label: string;
  failureNote?: string;
  evidence?: string;
}

export interface CategoryScore {
  id: CategoryId;
  label: string;
  score: number;
  maxScore: 5;
  checks: CheckResult[];
  failingChecks: CheckResult[];
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
  priority: number;
}

export interface ToolReadiness {
  tool: TargetTool;
  status: "ready" | "needs-work" | "not-scored";
  score?: number;
  maxScore?: 5;
  checks?: CheckResult[];
  note?: string;
}

export interface ToolSpecificFixItem {
  tool: TargetTool;
  checkId: string;
  action: string;
  effort: "quick" | "medium" | "heavy";
  priority: number;
}

export interface ScoringResult {
  overallScore: number;
  categoryScores: CategoryScore[];
  topBlockers: Blocker[];
  fixPlan: FixItem[];
  toolReadiness: ToolReadiness[];
  toolSpecificFixes: ToolSpecificFixItem[];
}

// Artifacts

export interface ArtifactResult {
  id: "agents" | "claude" | "validation-checklist" | "architecture-outline";
  filename: string;
  targetPath: string;
  skipped: boolean;
  written: boolean;
  content: string;
}

// Report

export interface AuditReport {
  version: "2";
  generatedAt: string;
  input: AuditInput;
  evidence: RepoEvidence;
  scoring: ScoringResult;
  artifacts: ArtifactResult[];
  deepAudit?: DeepAuditResult;
}
