import { describe, it, expect, vi } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { collectEvidence } from "../../src/inspection/local.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

describe("collectEvidence — minimal fixture", () => {
  it("detects package.json, no docs or tests", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    // FileSignals — all false
    expect(ev.files.hasAgentsMd).toBe(false);
    expect(ev.files.hasCLAUDEMd).toBe(false);
    expect(ev.files.hasReadme).toBe(false);
    expect(ev.files.hasContributing).toBe(false);
    expect(ev.files.hasArchitectureDocs).toBe(false);
    expect(ev.files.hasEnvExample).toBe(false);
    expect(ev.files.hasDocsDir).toBe(false);
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
    expect(ev.files.hasContributing).toBe(true);
    expect(ev.files.hasArchitectureDocs).toBe(true);
    expect(ev.files.hasEnvExample).toBe(true);
    expect(ev.files.hasDocsDir).toBe(true);
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
  it("exits with code 2 for missing path", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(
      collectEvidence("/nonexistent/path/does/not/exist")
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(2);
    exitSpy.mockRestore();
  });

  it("exits with code 2 for a file path (not a directory)", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    await expect(
      collectEvidence(join(fixturesDir, "minimal/package.json"))
    ).rejects.toThrow("process.exit called");

    expect(exitSpy).toHaveBeenCalledWith(2);
    exitSpy.mockRestore();
  });
});
