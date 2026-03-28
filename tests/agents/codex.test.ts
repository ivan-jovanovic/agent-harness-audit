import { writeFile } from "node:fs/promises";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/agents/command.js", () => ({
  runCommand: vi.fn(),
}));

import { CodexAdapter } from "../../src/agents/codex.js";
import { runCommand } from "../../src/agents/command.js";
import type { RepoEvidence } from "../../src/types.js";

const runCommandMock = vi.mocked(runCommand);

const EVIDENCE: RepoEvidence = {
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

describe("CodexAdapter", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("detect returns true when codex --version exits 0", async () => {
    runCommandMock.mockResolvedValue({
      stdout: "codex-cli 0.0.0",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 10,
    });

    const adapter = new CodexAdapter();
    await expect(adapter.detect()).resolves.toBe(true);
  });

  it("invoke parses findings from --output-last-message file", async () => {
    runCommandMock.mockImplementation(async (_command, args) => {
      const outIndex = args.indexOf("--output-last-message");
      const outPath = args[outIndex + 1];
      await writeFile(
        outPath,
        JSON.stringify({
          findings: [
            {
              checkId: "has_test_script",
              passed: true,
              evidence: "Found a test script in package.json",
            },
          ],
        }),
        "utf-8",
      );

      return {
        stdout: "",
        stderr: "non-fatal warning",
        exitCode: 0,
        signal: null,
        durationMs: 220,
      };
    });

    const adapter = new CodexAdapter();
    const result = await adapter.invoke(process.cwd(), EVIDENCE);
    expect(result.agentName).toBe("codex");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].checkId).toBe("has_test_script");
  });

  it("invoke throws when codex payload cannot be parsed", async () => {
    runCommandMock.mockResolvedValue({
      stdout: "garbage",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 220,
    });

    const adapter = new CodexAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toThrow("no parseable payload");
  });
});
