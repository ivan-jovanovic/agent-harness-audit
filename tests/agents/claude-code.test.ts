import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/agents/command.js", () => ({
  runCommand: vi.fn(),
}));

import { ClaudeCodeAdapter } from "../../src/agents/claude-code.js";
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

describe("ClaudeCodeAdapter", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("detect returns true when claude --version exits 0", async () => {
    runCommandMock.mockResolvedValue({
      stdout: "claude 1.0.0",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 10,
    });

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.detect()).resolves.toBe(true);
  });

  it("invoke parses structured_output findings", async () => {
    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify({
        structured_output: {
          findings: [
            {
              checkId: "has_primary_instructions",
              passed: true,
              evidence: "Found AGENTS guidance",
            },
          ],
        },
        usage: { total_tokens: 123 },
        total_cost_usd: 0.002,
      }),
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 200,
    });

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(process.cwd(), EVIDENCE);
    expect(result.agentName).toBe("claude-code");
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].checkId).toBe("has_primary_instructions");
    expect(result.tokensActual).toBe(123);
    expect(result.costActualUsd).toBe(0.002);
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    const call = runCommandMock.mock.calls[0];
    expect(call[0]).toBe("claude");
    expect(call[1]).toEqual(expect.arrayContaining(["--permission-mode", "dontAsk", "--tools", ""]));
  });

  it("invoke throws on malformed JSON response", async () => {
    runCommandMock.mockResolvedValue({
      stdout: "not json",
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 200,
    });

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toThrow("not valid JSON");
  });

  it("invoke throws when no valid findings are returned", async () => {
    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify({ structured_output: { findings: [] } }),
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 200,
    });

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toThrow("no valid findings");
  });
});
