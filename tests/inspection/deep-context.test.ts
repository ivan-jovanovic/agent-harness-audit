import { describe, it, expect } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { collectEvidence } from "../../src/inspection/local.js";
import { collectDeepAuditContext } from "../../src/inspection/deep-context.js";
import type { RepoEvidence } from "../../src/types.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

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

describe("collectDeepAuditContext", () => {
  it("collects the expected excerpt sections from the strong fixture", async () => {
    const evidence = await collectEvidence(join(fixturesDir, "strong"));
    const context = await collectDeepAuditContext(join(fixturesDir, "strong"), evidence);
    const kinds = context.sections.map((section) => section.kind);

    expect(kinds).toContain("root-tree");
    expect(kinds).toContain("instructions");
    expect(kinds).toContain("docs-index");
    expect(kinds).toContain("package-scripts");
    expect(kinds).toContain("workflows");
    expect(kinds).toContain("architecture-doc");
    expect(context.sections.length).toBeLessThanOrEqual(7);

    const rootTree = context.sections.find((section) => section.kind === "root-tree");
    expect(rootTree?.content).toContain("AGENTS.md");
    expect(rootTree?.content).toContain("docs/");

    const packageScripts = context.sections.find((section) => section.kind === "package-scripts");
    expect(packageScripts?.content).toContain("package.json");
    expect(packageScripts?.content).toContain("build:");

    const workflows = context.sections.find((section) => section.kind === "workflows");
    expect(workflows?.content).toContain(".github/workflows/");
  });

  it("caps the root tree summary when many entries are present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-deep-context-"));
    try {
      mkdirSync(join(dir, "nested"), { recursive: true });
      writeFileSync(join(dir, "package.json"), JSON.stringify({ scripts: {} }), "utf-8");
      for (let index = 0; index < 55; index += 1) {
        writeFileSync(join(dir, `file-${index.toString().padStart(2, "0")}.txt`), "x", "utf-8");
      }

      const context = await collectDeepAuditContext(dir, makeEvidence());
      const rootTree = context.sections.find((section) => section.kind === "root-tree");
      expect(rootTree).toBeDefined();
      expect(rootTree?.content.split("\n").length).toBeLessThanOrEqual(41);
      expect(rootTree?.content).toContain("... (+");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("discovers nested docs under docs/ within the recursion cap", async () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-nested-docs-"));
    try {
      mkdirSync(join(dir, "docs", "security", "deep"), { recursive: true });
      writeFileSync(join(dir, "docs", "security", "hardening.md"), "# hardening", "utf-8");
      writeFileSync(join(dir, "docs", "security", "deep", "runbook.md"), "# runbook", "utf-8");

      const context = await collectDeepAuditContext(dir, makeEvidence());
      const architectureDocs = context.sections.filter((section) => section.kind === "architecture-doc");
      expect(architectureDocs.some((section) => section.title === "docs/security/hardening.md")).toBe(true);
      expect(architectureDocs.some((section) => section.title === "docs/security/deep/runbook.md")).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("prioritizes high-signal plan docs under docs/plans while keeping selection bounded", async () => {
    const dir = mkdtempSync(join(tmpdir(), "harness-plan-docs-"));
    try {
      mkdirSync(join(dir, "docs", "plans"), { recursive: true });
      writeFileSync(join(dir, "ARCHITECTURE.md"), "# architecture", "utf-8");
      writeFileSync(join(dir, "product-roadmap-v1.md"), "# roadmap", "utf-8");
      writeFileSync(join(dir, "docs", "plans", "execution-plan.md"), "# execution", "utf-8");
      writeFileSync(join(dir, "docs", "plans", "refactor-plan.md"), "# refactor", "utf-8");

      const context = await collectDeepAuditContext(dir, makeEvidence());
      const selectedTitles = context.sections
        .filter((section) => section.kind === "architecture-doc")
        .map((section) => section.title);

      expect(selectedTitles).toEqual([
        "docs/plans/execution-plan.md",
        "docs/plans/refactor-plan.md",
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
