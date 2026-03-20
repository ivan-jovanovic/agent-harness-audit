import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { generateArtifacts, previewArtifacts } from "../../src/artifacts/generate.js";
import type { RepoEvidence, AuditInput } from "../../src/types.js";

const BASE_EVIDENCE: RepoEvidence = {
  files: {
    hasAgentsMd: false,
    hasCLAUDEMd: false,
    hasReadme: false,
    hasContributing: false,
    hasArchitectureDocs: false,
    hasEnvExample: false,
    hasDocsDir: false,
  },
  packages: {
    hasPackageJson: false,
    hasLockfile: false,
    scripts: { hasLint: false, hasTypecheck: false, hasTest: false, hasBuild: false },
    warnings: [],
  },
  tests: {
    hasTestDir: false,
    hasTestFiles: false,
    hasVitestConfig: false,
    hasJestConfig: false,
    hasPlaywrightConfig: false,
  },
  workflows: { hasCIWorkflows: false, workflowCount: 0 },
  context: { hasTsConfig: false, detectedLanguage: "typescript", hasEslintConfig: false },
  warnings: [],
};

const BASE_INPUT: AuditInput = {
  path: "/tmp/test-project",
  tool: "other",
  safetyLevel: "medium",
  jsonMode: false,
  writeArtifacts: true,
};

function makeTmpDir(): string {
  return mkdtempSync(join(tmpdir(), "harness-artifacts-test-"));
}

describe("generateArtifacts", () => {
  const tmps: string[] = [];
  afterEach(() => {
    for (const d of tmps) rmSync(d, { recursive: true, force: true });
    tmps.length = 0;
  });

  it("writes all 3 artifact files into an empty directory", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.written)).toBe(true);
    expect(results.every((r) => !r.skipped)).toBe(true);

    const filenames = results.map((r) => r.filename);
    expect(filenames).toContain("AGENTS.generated.md");
    expect(filenames).toContain("validation-checklist.generated.md");
    expect(filenames).toContain("architecture-outline.generated.md");
  });

  it("artifact content contains substituted project name", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const agents = results.find((r) => r.id === "agents")!;

    // basename of dir will appear in content
    expect(agents.content).toContain("# Agent Instructions —");
    expect(agents.content).not.toContain("{{PROJECT_NAME}}");
    expect(agents.content).not.toContain("{{GENERATED_DATE}}");
  });

  it("skips AGENTS.generated.md when AGENTS.md already exists", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    writeFileSync(join(dir, "AGENTS.md"), "# existing");
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const agents = results.find((r) => r.id === "agents")!;

    expect(agents.skipped).toBe(true);
    expect(agents.written).toBe(false);
  });

  it("skips AGENTS.generated.md when AGENTS.generated.md already exists", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    writeFileSync(join(dir, "AGENTS.generated.md"), "# existing generated");
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const agents = results.find((r) => r.id === "agents")!;

    expect(agents.skipped).toBe(true);
    expect(agents.written).toBe(false);
  });

  it("skips architecture-outline when ARCHITECTURE.md already exists", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    writeFileSync(join(dir, "ARCHITECTURE.md"), "# existing arch");
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const arch = results.find((r) => r.id === "architecture-outline")!;

    expect(arch.skipped).toBe(true);
    expect(arch.written).toBe(false);
  });

  it("dry run does not write files but returns content", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    const input = { ...BASE_INPUT, path: dir };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, true);

    expect(results.every((r) => r.written)).toBe(false);
    expect(results.every((r) => r.content.length > 0)).toBe(true);

    // No files should exist on disk
    const { readdirSync } = await import("node:fs");
    expect(readdirSync(dir)).toHaveLength(0);
  });

  it("includes Claude Code settings section when tool is claude-code", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    const input = { ...BASE_INPUT, path: dir, tool: "claude-code" as const };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const agents = results.find((r) => r.id === "agents")!;

    expect(agents.content).toContain("Claude Code Settings");
    expect(agents.content).toContain("permissions");
  });

  it("does not include Claude Code section when tool is other", async () => {
    const dir = makeTmpDir();
    tmps.push(dir);
    const input = { ...BASE_INPUT, path: dir, tool: "other" as const };

    const results = await generateArtifacts(dir, BASE_EVIDENCE, input, false);
    const agents = results.find((r) => r.id === "agents")!;

    expect(agents.content).not.toContain("Claude Code Settings");
  });
});

describe("previewArtifacts", () => {
  it("returns 3 artifacts with content, all written=false", () => {
    const results = previewArtifacts("/some/project", BASE_EVIDENCE, BASE_INPUT);

    expect(results).toHaveLength(3);
    expect(results.every((r) => !r.written)).toBe(true);
    expect(results.every((r) => r.content.length > 0)).toBe(true);
  });

  it("does not contain unreplaced tokens", () => {
    const results = previewArtifacts("/some/project", BASE_EVIDENCE, BASE_INPUT);
    for (const r of results) {
      expect(r.content).not.toMatch(/\{\{[A-Z_]+\}\}/);
    }
  });

  it("sets skipped=true for guarded artifacts when canonical exists", () => {
    // Point at a known directory that has AGENTS.md (fixtures/strong)
    const strongFixture = resolve(
      new URL("../../fixtures/strong", import.meta.url).pathname,
    );
    const results = previewArtifacts(strongFixture, BASE_EVIDENCE, BASE_INPUT);
    const agents = results.find((r) => r.id === "agents")!;
    expect(agents.skipped).toBe(true);
  });
});
