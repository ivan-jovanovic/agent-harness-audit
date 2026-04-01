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

import { runAudit } from "../../src/commands/audit.js";
import { collectEvidence } from "../../src/inspection/local.js";
import { collectDeepAuditContext } from "../../src/inspection/deep-context.js";
import { discoverAgents, selectAgent, getAgentAdapter } from "../../src/agents/index.js";
import { scoreProject } from "../../src/scoring/index.js";
import { previewArtifacts } from "../../src/artifacts/generate.js";
import type { RepoEvidence } from "../../src/types.js";

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
    warnings: [],
  };
}

describe("runAudit deep context wiring", () => {
  beforeEach(() => {
    collectEvidenceMock.mockReset();
    collectDeepAuditContextMock.mockReset();
    discoverAgentsMock.mockReset();
    selectAgentMock.mockReset();
    getAgentAdapterMock.mockReset();
    scoreProjectMock.mockReset();
    previewArtifactsMock.mockReset();
  });

  it("passes deterministic deep excerpts to the selected adapter", async () => {
    const evidence = makeEvidence();
    const deepContext = {
      sections: [
        {
          kind: "root-tree" as const,
          title: "Root file tree summary",
          path: "/repo",
          content: "README.md",
          truncated: false,
        },
      ],
    };

    const invoke = vi.fn().mockResolvedValue({
      agentName: "claude-code" as const,
      findings: [],
      tokenEstimate: 10,
      tokensActual: 10,
      costEstimateUsd: 0,
      costActualUsd: 0,
      durationMs: 1,
    });

    collectEvidenceMock.mockResolvedValue(evidence);
    collectDeepAuditContextMock.mockResolvedValue(deepContext);
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
      safetyLevel: "low",
      jsonMode: true,
      writeArtifacts: false,
      deep: true,
      tokens: false,
      verbose: false,
      debug: false,
      noColor: true,
    });

    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("/repo", evidence, deepContext);
    expect(report.deepAudit?.agentName).toBe("claude-code");
  });
});
