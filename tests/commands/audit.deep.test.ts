import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/inspection/local.js", () => ({
  collectEvidence: vi.fn(),
}));

vi.mock("../../src/inspection/deep-context.js", () => ({
  collectDeepAuditContext: vi.fn(),
}));

vi.mock("../../src/agents/index.js", () => ({
  discoverAgents: vi.fn(),
  selectAgent: vi.fn(),
  getAgentAdapter: vi.fn(),
}));

vi.mock("../../src/scoring/index.js", () => ({
  scoreProject: vi.fn(),
}));

vi.mock("../../src/artifacts/generate.js", () => ({
  generateArtifacts: vi.fn(),
  previewArtifacts: vi.fn(),
}));

import { mergeDeepFindings, runAudit } from "../../src/commands/audit.js";
import { collectEvidence } from "../../src/inspection/local.js";
import { collectDeepAuditContext } from "../../src/inspection/deep-context.js";
import { discoverAgents, selectAgent, getAgentAdapter } from "../../src/agents/index.js";
import { scoreProject } from "../../src/scoring/index.js";
import { previewArtifacts } from "../../src/artifacts/generate.js";
import type { RepoEvidence, DeepAuditFinding } from "../../src/types.js";

const collectEvidenceMock = vi.mocked(collectEvidence);
const collectDeepAuditContextMock = vi.mocked(collectDeepAuditContext);
const discoverAgentsMock = vi.mocked(discoverAgents);
const selectAgentMock = vi.mocked(selectAgent);
const getAgentAdapterMock = vi.mocked(getAgentAdapter);
const scoreProjectMock = vi.mocked(scoreProject);
const previewArtifactsMock = vi.mocked(previewArtifacts);

function makeEvidence(): RepoEvidence {
  return {
    files: {
      hasAgentsMd: false,
      hasCLAUDEMd: false,
      hasReadme: false,
      hasGenericSkills: false,
      hasClaudeSkills: false,
      hasCursorSkills: false,
      hasArchitectureDocs: false,
      hasEnvExample: false,
      hasDocsDir: false,
      hasDocsIndex: false,
      hasStructuredDocs: false,
    },
    packages: {
      hasPackageJson: false,
      hasLockfile: false,
      hasArchitectureLints: false,
      scripts: {
        hasLocalDevBootPath: false,
        hasLint: false,
        hasTypecheck: false,
        hasTest: false,
        hasBuild: false,
      },
      warnings: [],
    },
    tests: {
      hasTestDir: false,
      hasTestFiles: false,
      hasE2eOrSmokeTests: false,
      hasVitestConfig: false,
      hasJestConfig: false,
      hasPlaywrightConfig: false,
    },
    workflows: {
      hasCIPipeline: false,
      hasCIWorkflows: false,
      hasCIValidation: false,
      workflowCount: 0,
    },
    context: {
      hasTsConfig: false,
      detectedLanguage: "unknown",
      hasEslintConfig: false,
    },
    levelOnlyChecks: {
      has_execution_plans: false,
      has_short_navigational_instructions: false,
      has_observability_signals: false,
      has_quality_or_debt_tracking: false,
    },
    warnings: [],
  };
}

describe("mergeDeepFindings", () => {
  it("does not infer claude/cursor skill booleans from has_tool_skills", () => {
    const evidence = makeEvidence();
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "instructions",
        checkId: "has_tool_skills",
        passed: true,
        label: "Tool skills present",
        evidence: "Agent found tool skills coverage",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.files.hasClaudeSkills).toBe(false);
    expect(merged.evidence.files.hasCursorSkills).toBe(false);
    expect(merged.overrides.has_tool_skills).toBe(true);
  });

  it("upgrades CI pipeline evidence when validation passes", () => {
    const evidence = makeEvidence();
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "feedback",
        checkId: "has_ci_validation",
        passed: true,
        label: "CI validation present",
        evidence: "GitLab CI runs npm test",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.workflows.hasCIPipeline).toBe(true);
    expect(merged.evidence.workflows.hasCIWorkflows).toBe(true);
    expect(merged.evidence.workflows.hasCIValidation).toBe(true);
  });

  it("upgrades only CI pipeline evidence when pipeline is found", () => {
    const evidence = makeEvidence();
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "feedback",
        checkId: "has_ci_pipeline",
        passed: true,
        label: "CI pipeline present",
        evidence: "Found .github/workflows/ci.yml",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.workflows.hasCIPipeline).toBe(true);
    expect(merged.evidence.workflows.hasCIWorkflows).toBe(true);
    expect(merged.evidence.workflows.hasCIValidation).toBe(false);
  });

  it("upgrades level-only checks when deep finding passes", () => {
    const evidence = makeEvidence();
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "context",
        checkId: "has_execution_plans",
        passed: true,
        label: "Execution plans present",
        evidence: "Found docs/plans/q3.md",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.levelOnlyChecks?.has_execution_plans).toBe(true);
  });

  it("does not upgrade has_env_example from deep findings", () => {
    const evidence = makeEvidence();
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "context",
        checkId: "has_env_example",
        passed: true,
        label: ".env.example present",
        evidence: "Found .env.tools.dist",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.files.hasEnvExample).toBe(false);
  });

  it("does not downgrade existing true level-only checks when deep finding fails", () => {
    const evidence = makeEvidence();
    if (evidence.levelOnlyChecks) {
      evidence.levelOnlyChecks.has_observability_signals = true;
    }
    const findings: DeepAuditFinding[] = [
      {
        categoryId: "safety",
        checkId: "has_observability_signals",
        passed: false,
        label: "Observability signals present",
        evidence: "No additional observability evidence in deep pass",
      },
    ];

    const merged = mergeDeepFindings(evidence, findings);
    expect(merged.evidence.levelOnlyChecks?.has_observability_signals).toBe(true);
  });
});

describe("runAudit deep descriptive fields", () => {
  beforeEach(() => {
    collectEvidenceMock.mockReset();
    collectDeepAuditContextMock.mockReset();
    discoverAgentsMock.mockReset();
    selectAgentMock.mockReset();
    getAgentAdapterMock.mockReset();
    scoreProjectMock.mockReset();
    previewArtifactsMock.mockReset();
  });

  it("carries strengths, risks, and blockers without changing scoring merge semantics", async () => {
    const evidence = makeEvidence();
    const invoke = vi.fn().mockResolvedValue({
      agentName: "claude-code" as const,
      findings: [
        {
          categoryId: "instructions" as const,
          checkId: "has_readme",
          passed: false,
          label: "README present",
          evidence: "No README found at the repo root",
          failureNote: "Add a README with setup steps.",
        },
      ],
      strengths: ["Repo layout is easy to navigate"],
      risks: ["Validation remains mostly manual"],
      autonomyBlockers: ["Missing environment setup contract"],
      tokenEstimate: 12,
      tokensActual: 14,
      costEstimateUsd: 0,
      costActualUsd: 0,
      durationMs: 50,
    });

    collectEvidenceMock.mockResolvedValue(evidence);
    collectDeepAuditContextMock.mockResolvedValue({ sections: [] });
    discoverAgentsMock.mockResolvedValue({ available: ["claude-code"] });
    selectAgentMock.mockReturnValue("claude-code");
    getAgentAdapterMock.mockReturnValue({
      name: "claude-code",
      detect: vi.fn(),
      invoke,
    });
    scoreProjectMock.mockReturnValue({
      overallScore: 0,
      categoryScores: [],
      topBlockers: [],
      fixPlan: [],
      toolReadiness: [],
      toolSpecificFixes: [],
    });
    previewArtifactsMock.mockReturnValue([]);

    const report = await runAudit({
      path: "/repo",
      toolsRequested: "all",
      toolsResolved: ["claude-code"],
      safetyLevel: "medium",
      jsonMode: true,
      writeArtifacts: false,
      deep: true,
      tokens: false,
      verbose: false,
      debug: false,
      noColor: true,
    });

    expect(report.deepAudit?.strengths).toEqual(["Repo layout is easy to navigate"]);
    expect(report.deepAudit?.risks).toEqual(["Validation remains mostly manual"]);
    expect(report.deepAudit?.autonomyBlockers).toEqual(["Missing environment setup contract"]);
    expect(scoreProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        files: expect.objectContaining({
          hasReadme: false,
        }),
      }),
      {
        toolsRequested: "all",
        toolsResolved: ["claude-code"],
      },
      {},
    );
  });

  it("passes upgraded level-only checks into scoring without downgrading existing true values", async () => {
    const evidence = makeEvidence();
    if (evidence.levelOnlyChecks) {
      evidence.levelOnlyChecks.has_observability_signals = true;
    }
    const invoke = vi.fn().mockResolvedValue({
      agentName: "claude-code" as const,
      findings: [
        {
          categoryId: "context" as const,
          checkId: "has_execution_plans",
          passed: true,
          label: "Execution plans present",
          evidence: "Found plans/q3.md",
        },
        {
          categoryId: "safety" as const,
          checkId: "has_observability_signals",
          passed: false,
          label: "Observability signals present",
          evidence: "No new signal from deep pass",
        },
      ],
      tokenEstimate: 12,
      tokensActual: 14,
      costEstimateUsd: 0,
      costActualUsd: 0,
      durationMs: 50,
    });

    collectEvidenceMock.mockResolvedValue(evidence);
    collectDeepAuditContextMock.mockResolvedValue({ sections: [] });
    discoverAgentsMock.mockResolvedValue({ available: ["claude-code"] });
    selectAgentMock.mockReturnValue("claude-code");
    getAgentAdapterMock.mockReturnValue({
      name: "claude-code",
      detect: vi.fn(),
      invoke,
    });
    scoreProjectMock.mockReturnValue({
      overallScore: 0,
      categoryScores: [],
      topBlockers: [],
      fixPlan: [],
      toolReadiness: [],
      toolSpecificFixes: [],
    });
    previewArtifactsMock.mockReturnValue([]);

    const report = await runAudit({
      path: "/repo",
      toolsRequested: "all",
      toolsResolved: ["claude-code"],
      safetyLevel: "medium",
      jsonMode: true,
      writeArtifacts: false,
      deep: true,
      tokens: false,
      verbose: false,
      debug: false,
      noColor: true,
    });

    expect(scoreProjectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        levelOnlyChecks: expect.objectContaining({
          has_execution_plans: true,
          has_observability_signals: true,
        }),
      }),
      {
        toolsRequested: "all",
        toolsResolved: ["claude-code"],
      },
      {},
    );
    expect(report.evidence.levelOnlyChecks?.has_execution_plans).toBe(true);
    expect(report.evidence.levelOnlyChecks?.has_observability_signals).toBe(true);
  });
});
