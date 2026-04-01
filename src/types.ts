// Errors

/** Thrown for invalid arguments or bad input paths — CLI exits with code 2. */
export class AuditUsageError extends Error {
  agent?: AgentName;

  constructor(message: string, agent?: AgentName) {
    super(message);
    this.name = "AuditUsageError";
    this.agent = agent;
  }
}

export interface CliErrorEnvelope {
  error: {
    code: "usage_error" | "unexpected_error";
    message: string;
    agent?: AgentName;
  };
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
  hasStructuredDocs: boolean;
}

export interface PackageSignals {
  hasPackageJson: boolean;
  hasLockfile: boolean;
  hasArchitectureLints: boolean;
  observabilityDependencies?: string[];
  lockfileType?: "npm" | "pnpm" | "yarn";
  scripts: {
    hasLocalDevBootPath: boolean;
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
  hasE2eOrSmokeTests: boolean;
  testFramework?: "vitest" | "jest" | "playwright" | "unknown";
  hasVitestConfig: boolean;
  hasJestConfig: boolean;
  hasPlaywrightConfig: boolean;
}

export interface WorkflowSignals {
  hasCIPipeline: boolean;
  hasCIWorkflows: boolean;
  hasCIValidation: boolean;
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
  levelOnlyChecks?: LevelOnlyEvidence;
  warnings: string[];
}

// Agent discovery / deep audit

export interface AgentDiscoveryResult {
  available: AgentName[];
  selected?: AgentName;
}

export type DeepAuditExcerptKind =
  | "root-tree"
  | "instructions"
  | "docs-index"
  | "docs-listing"
  | "package-scripts"
  | "workflows"
  | "architecture-doc";

export interface DeepAuditExcerptSection {
  kind: DeepAuditExcerptKind;
  title: string;
  path?: string;
  content: string;
  truncated: boolean;
}

export interface DeepAuditContext {
  sections: DeepAuditExcerptSection[];
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
  strengths?: string[];
  risks?: string[];
  autonomyBlockers?: string[];
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

export type ReadinessLevelId = 1 | 2 | 3 | 4;
export type ReadinessLevelLabel = "Bootstrap" | "Baseline" | "Reliable" | "Autonomous-Ready";
export type ReadinessLevelGateSet = "level1" | "level2" | "level3" | "level4_additional";
export type LevelOnlyCheckId =
  | "has_execution_plans"
  | "has_short_navigational_instructions"
  | "has_observability_signals"
  | "has_quality_or_debt_tracking";
export type LevelOnlyEvidence = Record<LevelOnlyCheckId, boolean>;
export type LevelOnlyCheckStates = Partial<Record<LevelOnlyCheckId, boolean>>;

export interface NormalizedCheckState {
  id: string;
  passed: boolean;
  label: string;
  categoryId?: CategoryId;
  source: "scored" | "level-only";
}

export interface ReadinessLevelResult {
  id: ReadinessLevelId;
  label: ReadinessLevelLabel;
  blockingGateSet: ReadinessLevelGateSet;
  failedHardGates: string[];
  nextLevelId?: Exclude<ReadinessLevelId, 1>;
}

export interface ReadinessStagedFixes {
  now: string[];
  next: string[];
  later: string[];
}

export interface ReportLevel extends ReadinessLevelResult {
  stagedFixes: ReadinessStagedFixes;
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
  level?: ReportLevel;
  artifacts: ArtifactResult[];
  deepAudit?: DeepAuditResult;
}
