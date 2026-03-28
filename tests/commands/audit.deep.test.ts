import { describe, it, expect } from "vitest";
import { mergeDeepFindings } from "../../src/commands/audit.js";
import type { RepoEvidence, DeepAuditFinding } from "../../src/types.js";

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
    },
    packages: {
      hasPackageJson: false,
      hasLockfile: false,
      scripts: {
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
      hasVitestConfig: false,
      hasJestConfig: false,
      hasPlaywrightConfig: false,
    },
    workflows: {
      hasCIWorkflows: false,
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
});
