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
    expect(ev.packages.scripts.hasLocalDevBootPath).toBe(false);
    // TestSignals — all false
    expect(ev.tests.hasTestDir).toBe(false);
    expect(ev.tests.hasTestFiles).toBe(false);
    expect(ev.tests.hasE2eOrSmokeTests).toBe(false);
    // WorkflowSignals — none
    expect(ev.workflows.hasCIPipeline).toBe(false);
    expect(ev.workflows.hasCIWorkflows).toBe(false);
    expect(ev.workflows.hasCIValidation).toBe(false);
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
    expect(ev.packages.scripts.hasLocalDevBootPath).toBe(false);
    expect(ev.packages.scripts.hasTest).toBe(true);
    expect(ev.workflows.hasCIPipeline).toBe(false);
    expect(ev.workflows.hasCIWorkflows).toBe(false);
    expect(ev.workflows.hasCIValidation).toBe(false);
    expect(ev.tests.hasE2eOrSmokeTests).toBe(false);
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
    expect(ev.files.hasStructuredDocs).toBe(true);
    expect(ev.packages.scripts.hasLint).toBe(true);
    expect(ev.packages.scripts.hasTypecheck).toBe(true);
    expect(ev.packages.scripts.hasTest).toBe(true);
    expect(ev.packages.scripts.hasBuild).toBe(true);
    expect(ev.packages.hasArchitectureLints).toBe(true);
    expect(ev.packages.scripts.hasLocalDevBootPath).toBe(true);
    expect(ev.tests.hasTestDir).toBe(true);
    expect(ev.tests.hasVitestConfig).toBe(true);
    expect(ev.tests.testFramework).toBe("vitest");
    expect(ev.workflows.hasCIPipeline).toBe(true);
    expect(ev.workflows.hasCIWorkflows).toBe(true);
    expect(ev.workflows.hasCIValidation).toBe(true);
    expect(ev.workflows.workflowCount).toBe(1);
    expect(ev.tests.hasE2eOrSmokeTests).toBe(true);
    expect(ev.context.hasTsConfig).toBe(true);
    expect(ev.context.detectedLanguage).toBe("typescript");
  });
});

describe("collectEvidence — structured docs hardening", () => {
  function makeRepo(): string {
    return mkdtempSync(join(tmpdir(), "harness-structured-docs-"));
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("does not pass on an empty docs subdirectory plus one markdown file", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, "docs", "empty"), { recursive: true });
      writeFileSync(join(dir, "docs", "index.md"), "# docs");

      const ev = await collectEvidence(dir);
      expect(ev.files.hasDocsDir).toBe(true);
      expect(ev.files.hasDocsIndex).toBe(true);
      expect(ev.files.hasStructuredDocs).toBe(false);
    } finally {
      cleanup(dir);
    }
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
    expect(ev.files.hasStructuredDocs).toBe(true);
    expect(ev.context.detectedFramework).toBe("next");
    expect(ev.context.detectedLanguage).toBe("typescript");
    expect(ev.context.hasTsConfig).toBe(true);
    expect(ev.packages.hasLockfile).toBe(true);
    expect(ev.packages.lockfileType).toBe("pnpm");
    expect(ev.packages.hasArchitectureLints).toBe(true);
    expect(ev.packages.scripts.hasLocalDevBootPath).toBe(true);
    expect(ev.tests.hasTestDir).toBe(true);
    expect(ev.tests.hasVitestConfig).toBe(true);
    expect(ev.workflows.hasCIPipeline).toBe(true);
    expect(ev.workflows.hasCIWorkflows).toBe(true);
    expect(ev.workflows.hasCIValidation).toBe(true);
    expect(ev.tests.hasE2eOrSmokeTests).toBe(true);
  });
});

describe("collectEvidence — GitLab CI coverage", () => {
  function makeRepo(): string {
    return mkdtempSync(join(tmpdir(), "harness-gitlab-ci-"));
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("detects a GitLab pipeline without validation commands", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(
        join(dir, ".gitlab-ci.yml"),
        [
          "stages:",
          "  - deploy",
          "",
          "deploy:",
          "  stage: deploy",
          "  script:",
          "    - echo deploy",
          "",
        ].join("\n"),
      );

      const ev = await collectEvidence(dir);
      expect(ev.workflows.hasCIPipeline).toBe(true);
      expect(ev.workflows.hasCIWorkflows).toBe(true);
      expect(ev.workflows.hasCIValidation).toBe(false);
      expect(ev.workflows.workflowCount).toBe(1);
    } finally {
      cleanup(dir);
    }
  });

  it("detects validation commands in GitLab CI", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(
        join(dir, ".gitlab-ci.yml"),
        [
          "stages:",
          "  - test",
          "",
          "test:",
          "  stage: test",
          "  script:",
          "    - npm run test",
          "",
        ].join("\n"),
      );

      const ev = await collectEvidence(dir);
      expect(ev.workflows.hasCIPipeline).toBe(true);
      expect(ev.workflows.hasCIWorkflows).toBe(true);
      expect(ev.workflows.hasCIValidation).toBe(true);
      expect(ev.workflows.workflowCount).toBe(1);
    } finally {
      cleanup(dir);
    }
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

describe("collectEvidence — monorepo aggregation", () => {
  function makeRepo(): string {
    return mkdtempSync(join(tmpdir(), "harness-mono-evidence-"));
  }

  function cleanup(dir: string): void {
    rmSync(dir, { recursive: true, force: true });
  }

  it("collects package-root signals when the repo root has no package.json", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, "backend"), { recursive: true });
      mkdirSync(join(dir, "frontend", "e2e"), { recursive: true });

      writeFileSync(
        join(dir, "backend", "package.json"),
        JSON.stringify(
          {
            name: "backend",
            scripts: {
              dev: "vite",
              lint: "eslint src --ext .ts",
            },
            devDependencies: {
              "dependency-cruiser": "^15.0.0",
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      writeFileSync(join(dir, "backend", "package-lock.json"), "{}", "utf-8");
      writeFileSync(
        join(dir, "frontend", "package.json"),
        JSON.stringify(
          {
            name: "frontend",
            scripts: {
              test: "vitest run",
            },
          },
          null,
          2,
        ),
        "utf-8",
      );
      writeFileSync(join(dir, "frontend", "e2e", "smoke.spec.ts"), "test('smoke', () => {})", "utf-8");

      const ev = await collectEvidence(dir);
      expect(ev.packages.hasPackageJson).toBe(true);
      expect(ev.packages.hasLockfile).toBe(true);
      expect(ev.packages.hasArchitectureLints).toBe(true);
      expect(ev.packages.scripts.hasLocalDevBootPath).toBe(true);
      expect(ev.packages.scripts.hasLint).toBe(true);
      expect(ev.packages.scripts.hasTest).toBe(true);
      expect(ev.tests.hasE2eOrSmokeTests).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it("detects deeply nested e2e or smoke test paths", async () => {
    const dir = makeRepo();
    try {
      mkdirSync(join(dir, "apps", "web", "src", "integration", "smoke"), { recursive: true });
      writeFileSync(
        join(dir, "apps", "web", "src", "integration", "smoke", "smoke.spec.ts"),
        "test('smoke', () => {})",
        "utf-8",
      );

      const ev = await collectEvidence(dir);
      expect(ev.tests.hasE2eOrSmokeTests).toBe(true);
    } finally {
      cleanup(dir);
    }
  });

  it("detects Cypress and Webdriver config files as e2e signals", async () => {
    const dir = makeRepo();
    try {
      writeFileSync(join(dir, "cypress.config.ts"), "export default {}", "utf-8");
      writeFileSync(join(dir, "wdio.conf.js"), "exports.config = {}", "utf-8");

      const ev = await collectEvidence(dir);
      expect(ev.tests.hasE2eOrSmokeTests).toBe(true);
    } finally {
      cleanup(dir);
    }
  });
});
