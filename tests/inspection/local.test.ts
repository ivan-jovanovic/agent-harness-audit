import { describe, it, expect } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { collectEvidence } from "../../src/inspection/local.js";
import { AuditUsageError } from "../../src/types.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

describe("collectEvidence — minimal fixture", () => {
  it("detects package.json, no docs or tests", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    // FileSignals — all false
    expect(ev.files.hasAgentsMd).toBe(false);
    expect(ev.files.hasCLAUDEMd).toBe(false);
    expect(ev.files.hasReadme).toBe(false);
    expect(ev.files.hasArchitectureDocs).toBe(false);
    expect(ev.files.hasEnvExample).toBe(false);
    expect(ev.files.hasDocsDir).toBe(false);
    expect(ev.files.hasDocsIndex).toBe(false);
    // PackageSignals
    expect(ev.packages.hasPackageJson).toBe(true);
    expect(ev.packages.hasLockfile).toBe(false);
    // TestSignals — all false
    expect(ev.tests.hasTestDir).toBe(false);
    expect(ev.tests.hasTestFiles).toBe(false);
    // WorkflowSignals — none
    expect(ev.workflows.hasCIWorkflows).toBe(false);
    expect(ev.workflows.workflowCount).toBe(0);
    // ContextSignals
    expect(ev.context.hasTsConfig).toBe(false);
  });
});

describe("collectEvidence — partial fixture", () => {
  it("detects README and tests, no agent files", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    expect(ev.files.hasReadme).toBe(true);
    expect(ev.files.hasAgentsMd).toBe(false);
    expect(ev.files.hasCLAUDEMd).toBe(false);
    expect(ev.tests.hasTestDir).toBe(true);
    expect(ev.tests.hasJestConfig).toBe(true);
    expect(ev.tests.testFramework).toBe("jest");
    expect(ev.packages.hasLockfile).toBe(true);
    expect(ev.packages.lockfileType).toBe("npm");
    expect(ev.packages.scripts.hasTest).toBe(true);
    expect(ev.workflows.hasCIWorkflows).toBe(false);
  });
});

describe("collectEvidence — strong fixture", () => {
  it("most checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    expect(ev.files.hasAgentsMd).toBe(true);
    expect(ev.files.hasCLAUDEMd).toBe(true);
    expect(ev.files.hasReadme).toBe(true);
    expect(ev.files.hasArchitectureDocs).toBe(true);
    expect(ev.files.hasEnvExample).toBe(true);
    expect(ev.files.hasDocsDir).toBe(true);
    expect(ev.files.hasDocsIndex).toBe(true);
    expect(ev.packages.scripts.hasLint).toBe(true);
    expect(ev.packages.scripts.hasTypecheck).toBe(true);
    expect(ev.packages.scripts.hasTest).toBe(true);
    expect(ev.packages.scripts.hasBuild).toBe(true);
    expect(ev.tests.hasTestDir).toBe(true);
    expect(ev.tests.hasVitestConfig).toBe(true);
    expect(ev.tests.testFramework).toBe("vitest");
    expect(ev.workflows.hasCIWorkflows).toBe(true);
    expect(ev.workflows.workflowCount).toBe(1);
    expect(ev.context.hasTsConfig).toBe(true);
    expect(ev.context.detectedLanguage).toBe("typescript");
  });
});

describe("collectEvidence — ts-webapp fixture", () => {
  it("detects Next.js framework and all key signals", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    expect(ev.files.hasAgentsMd).toBe(true);
    expect(ev.files.hasReadme).toBe(true);
    expect(ev.files.hasEnvExample).toBe(true);
    expect(ev.files.hasDocsDir).toBe(true);
    expect(ev.files.hasArchitectureDocs).toBe(true);
    expect(ev.files.hasDocsIndex).toBe(true);
    expect(ev.context.detectedFramework).toBe("next");
    expect(ev.context.detectedLanguage).toBe("typescript");
    expect(ev.context.hasTsConfig).toBe(true);
    expect(ev.packages.hasLockfile).toBe(true);
    expect(ev.packages.lockfileType).toBe("pnpm");
    expect(ev.tests.hasTestDir).toBe(true);
    expect(ev.tests.hasVitestConfig).toBe(true);
    expect(ev.workflows.hasCIWorkflows).toBe(true);
  });
});

describe("collectEvidence — error handling", () => {
  it("throws AuditUsageError for missing path", async () => {
    await expect(
      collectEvidence("/nonexistent/path/does/not/exist")
    ).rejects.toThrow(AuditUsageError);

    await expect(
      collectEvidence("/nonexistent/path/does/not/exist")
    ).rejects.toThrow("path not found");
  });

  it("throws AuditUsageError for a file path (not a directory)", async () => {
    await expect(
      collectEvidence(join(fixturesDir, "minimal/package.json"))
    ).rejects.toThrow(AuditUsageError);

    await expect(
      collectEvidence(join(fixturesDir, "minimal/package.json"))
    ).rejects.toThrow("path is not a directory");
  });
});

describe("collectEvidence — skills directories", () => {
  function makeRepo(): string {
    return mkdtempSync(join(tmpdir(), "harness-skills-"));
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("detects nested SKILL.md under .agents/skills", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, ".agents", "skills", "workflow", "nested"), { recursive: true });
      writeFileSync(join(dir, ".agents", "skills", "workflow", "nested", "SKILL.md"), "# skill");

      const ev = await collectEvidence(dir);
      expect(ev.files.hasGenericSkills).toBe(true);
      expect(ev.files.hasClaudeSkills).toBe(false);
      expect(ev.files.hasCursorSkills).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it("treats empty skills directories as missing", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, ".agents", "skills"), { recursive: true });
      mkdirSync(join(dir, ".claude", "skills"), { recursive: true });
      mkdirSync(join(dir, ".cursor", "skills"), { recursive: true });

      const ev = await collectEvidence(dir);
      expect(ev.files.hasGenericSkills).toBe(false);
      expect(ev.files.hasClaudeSkills).toBe(false);
      expect(ev.files.hasCursorSkills).toBe(false);
    } finally {
      cleanup(dir);
    }
  });

  it("detects Claude and Cursor skills independently", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, ".claude", "skills", "agents"), { recursive: true });
      mkdirSync(join(dir, ".cursor", "skills", "recipes"), { recursive: true });
      writeFileSync(join(dir, ".claude", "skills", "agents", "SKILL.md"), "# claude skill");
      writeFileSync(join(dir, ".cursor", "skills", "recipes", "SKILL.md"), "# cursor skill");

      const ev = await collectEvidence(dir);
      expect(ev.files.hasGenericSkills).toBe(false);
      expect(ev.files.hasClaudeSkills).toBe(true);
      expect(ev.files.hasCursorSkills).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});

describe("collectEvidence — architecture docs detection", () => {
  function makeRepo(): string {
    return mkdtempSync(join(tmpdir(), "harness-arch-"));
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("accepts SYSTEM.md at the repo root as architecture guidance", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "SYSTEM.md"), "# system overview");

      const ev = await collectEvidence(dir);
      expect(ev.files.hasArchitectureDocs).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it("accepts docs/repo-structure.md as architecture guidance", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(join(dir, "docs", "repo-structure.md"), "# repo structure");

      const ev = await collectEvidence(dir);
      expect(ev.files.hasArchitectureDocs).toBe(true);
      expect(ev.files.hasDocsDir).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});
