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
});
