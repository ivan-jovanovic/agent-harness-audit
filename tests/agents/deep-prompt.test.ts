import { describe, expect, it } from "vitest";

import { buildDeepAuditPrompt, estimateDeepPromptTokens } from "../../src/agents/deep-prompt.js";
import type { DeepAuditContext, RepoEvidence } from "../../src/types.js";

const EVIDENCE: RepoEvidence = {
  files: {
    hasAgentsMd: true,
    hasCLAUDEMd: true,
    hasReadme: true,
    hasGenericSkills: false,
    hasClaudeSkills: false,
    hasCursorSkills: false,
    hasArchitectureDocs: true,
    hasEnvExample: true,
    hasDocsDir: true,
    hasDocsIndex: true,
    hasStructuredDocs: true,
  },
  packages: {
    hasPackageJson: true,
    hasLockfile: true,
    hasArchitectureLints: true,
    scripts: {
      hasLocalDevBootPath: true,
      hasLint: true,
      hasTypecheck: true,
      hasTest: true,
      hasBuild: true,
    },
    warnings: [],
  },
  tests: {
    hasTestDir: true,
    hasTestFiles: true,
    hasE2eOrSmokeTests: true,
    hasVitestConfig: true,
    hasJestConfig: false,
    hasPlaywrightConfig: true,
  },
  workflows: {
    hasCIPipeline: true,
    hasCIWorkflows: true,
    hasCIValidation: true,
    workflowCount: 2,
  },
  context: {
    hasTsConfig: true,
    detectedLanguage: "typescript",
    hasEslintConfig: true,
  },
  warnings: [],
};

const SMALL_CONTEXT: DeepAuditContext = {
  sections: [
    {
      kind: "root-tree",
      title: "Root file tree summary",
      path: "/repo",
      content: "AGENTS.md\nREADME.md",
      truncated: false,
    },
    {
      kind: "docs-index",
      title: "docs/index.md",
      path: "/repo/docs/index.md",
      content: "# docs",
      truncated: false,
    },
  ],
};

const LARGE_CONTEXT: DeepAuditContext = {
  sections: [
    {
      kind: "root-tree",
      title: "Root file tree summary",
      path: "/repo",
      content: "A".repeat(18_000),
      truncated: true,
    },
  ],
};

describe("buildDeepAuditPrompt", () => {
  it("builds a deterministic prompt with shared section ordering", () => {
    const first = buildDeepAuditPrompt("/repo", EVIDENCE, SMALL_CONTEXT);
    const second = buildDeepAuditPrompt("/repo", EVIDENCE, SMALL_CONTEXT);

    expect(first).toBe(second);
    expect(first).toContain("Pre-collected signals (heuristic layer):");
    expect(first).toContain("Heuristic evidence:");
    expect(first).toContain("Deep context excerpts (deterministic, bounded):");
    expect(first).toContain("Check intent guide:");
    expect(first).toContain("has_ci_validation");
    expect(first).toContain("has_e2e_or_smoke_tests");
    expect(first).toContain("has_execution_plans");
    expect(first).toContain("has_short_navigational_instructions");
    expect(first).toContain("has_observability_signals");
    expect(first).toContain("has_quality_or_debt_tracking");
    expect(first).toContain("has_env_example: canonical .env.example exists");
    expect(first).not.toContain("has_env_example: .env.example (or equivalent)");
    expect(first).toContain("concise AGENTS.md/CLAUDE.md instructions");
  });

  it("caps the prompt and truncates oversized context deterministically", () => {
    const prompt = buildDeepAuditPrompt("/repo", EVIDENCE, LARGE_CONTEXT, {
      maxPromptChars: 1_200,
      maxEvidenceChars: 120,
      maxContextChars: 80,
    });

    expect(prompt.length).toBeLessThanOrEqual(1_200);
    expect(prompt).toContain("Deep context excerpts (deterministic, bounded):");
    expect(prompt).toContain("... [truncated to keep the deep audit prompt bounded]");
    expect(estimateDeepPromptTokens("/repo", EVIDENCE, LARGE_CONTEXT)).toBeGreaterThan(0);
  });

  it("stays within a tiny prompt budget without throwing", () => {
    const prompt = buildDeepAuditPrompt("/repo", EVIDENCE, LARGE_CONTEXT, {
      maxPromptChars: 80,
      maxEvidenceChars: 20,
      maxContextChars: 20,
    });

    expect(prompt.length).toBeLessThanOrEqual(80);
    expect(prompt.length).toBeGreaterThan(0);
  });

  it("omits the context section cleanly when no excerpts are present", () => {
    const prompt = buildDeepAuditPrompt("/repo", EVIDENCE, { sections: [] });

    expect(prompt).not.toContain("Deep context excerpts (deterministic, bounded):");
    expect(prompt).toContain("Heuristic evidence:");
  });
});
