// Errors

/** Thrown for invalid arguments or bad input paths — CLI exits with code 2. */
export class AuditUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuditUsageError";
  }
}

// Input

export type AgentTool = "claude-code" | "cursor" | "copilot" | "codex" | "other";
export type SafetyLevel = "low" | "medium" | "high";

export interface AuditInput {
  path: string;
  tool: AgentTool;
  failureMode?: string;
  safetyLevel: SafetyLevel;
  jsonMode: boolean;
  writeArtifacts: boolean;
  outputFile?: string;
}

// Evidence

export interface FileSignals {
  hasAgentsMd: boolean;
  hasCLAUDEMd: boolean;
  hasReadme: boolean;
  hasContributing: boolean;
  hasArchitectureDocs: boolean;
  hasEnvExample: boolean;
  hasDocsDir: boolean;
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

// Scoring

export type CategoryId = "instructions" | "context" | "tooling" | "feedback" | "safety";

export interface CheckResult {
  id: string;
  passed: boolean;
  weight: number;
  label: string;
  failureNote?: string;
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

export interface ScoringResult {
  overallScore: number;
  categoryScores: CategoryScore[];
  topBlockers: Blocker[];
  fixPlan: FixItem[];
}

// Artifacts

export interface ArtifactResult {
  id: "agents" | "validation-checklist" | "architecture-outline";
  filename: string;
  targetPath: string;
  skipped: boolean;
  written: boolean;
  content: string;
}

// Report

export interface AuditReport {
  version: "1";
  generatedAt: string;
  input: AuditInput;
  evidence: RepoEvidence;
  scoring: ScoringResult;
  artifacts: ArtifactResult[];
}
