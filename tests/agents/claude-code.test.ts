import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/agents/command.js", async () => {
  const actual = await vi.importActual<typeof import("../../src/agents/command.js")>(
    "../../src/agents/command.js",
  );
  return {
    ...actual,
    runCommand: vi.fn(),
  };
});

import { ClaudeCodeAdapter } from "../../src/agents/claude-code.js";
import { CommandTimeoutError, runCommand } from "../../src/agents/command.js";
import type { DeepAuditContext, RepoEvidence } from "../../src/types.js";

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

const DEEP_CONTEXT: DeepAuditContext = {
  sections: [
    {
      kind: "root-tree",
      title: "Root file tree summary",
      path: "/repo",
      content: "AGENTS.md\nREADME.md",
      truncated: false,
    },
  ],
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
          strengths: ["Clear repo-level instructions"],
          risks: ["Validation loop is narrow"],
          autonomyBlockers: ["Missing environment bootstrap notes"],
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
    expect(result.strengths).toEqual(["Clear repo-level instructions"]);
    expect(result.risks).toEqual(["Validation loop is narrow"]);
    expect(result.autonomyBlockers).toEqual(["Missing environment bootstrap notes"]);
    expect(result.tokensActual).toBe(123);
    expect(result.costActualUsd).toBe(0.002);
    expect(runCommandMock).toHaveBeenCalledTimes(1);
    const call = runCommandMock.mock.calls[0];
    expect(call[0]).toBe("claude");
    expect(call[1]).toEqual(
      expect.arrayContaining(["--max-turns", "1", "--permission-mode", "dontAsk", "--tools", ""]),
    );
  });

  it("invoke includes deep context excerpts in the prompt payload", async () => {
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
        usage: { total_tokens: 10 },
        total_cost_usd: 0.001,
      }),
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 200,
    });

    const adapter = new ClaudeCodeAdapter();
    await adapter.invoke(process.cwd(), EVIDENCE, DEEP_CONTEXT);

    const call = runCommandMock.mock.calls[0];
    const prompt = call[1][1];
    expect(prompt).toContain("Deep context excerpts (deterministic, bounded):");
    expect(prompt).toContain("Root file tree summary");
    expect(prompt).toContain("AGENTS.md");
  });

  it("invoke accepts array payloads for findings normalization", async () => {
    runCommandMock.mockResolvedValue({
      stdout: JSON.stringify([
        {
          checkId: "has_primary_instructions",
          passed: true,
          evidence: "Found AGENTS guidance",
        },
      ]),
      stderr: "",
      exitCode: 0,
      signal: null,
      durationMs: 200,
    });

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(process.cwd(), EVIDENCE);

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].checkId).toBe("has_primary_instructions");
  });

  it("invoke retries once without --max-turns when the capped call returns no findings", async () => {
    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          subtype: "error_max_turns",
          stop_reason: "max_turns",
          result: "",
          structured_output: { findings: [] },
          usage: { total_tokens: 11 },
          total_cost_usd: 0.001,
        }),
        stderr: "hit max turns",
        exitCode: 0,
        signal: null,
        durationMs: 125,
      })
      .mockResolvedValueOnce({
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
          usage: { total_tokens: 29 },
          total_cost_usd: 0.002,
        }),
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 175,
      });

    const adapter = new ClaudeCodeAdapter();
    const result = await adapter.invoke(process.cwd(), EVIDENCE);

    expect(result.findings).toHaveLength(1);
    expect(result.tokensActual).toBe(40);
    expect(result.costActualUsd).toBeCloseTo(0.003, 6);
    expect(result.durationMs).toBe(300);
    expect(runCommandMock).toHaveBeenCalledTimes(2);

    const initialArgs = runCommandMock.mock.calls[0][1];
    expect(initialArgs).toEqual(
      expect.arrayContaining(["--max-turns", "1", "--permission-mode", "dontAsk", "--tools", ""]),
    );

    const fallbackArgs = runCommandMock.mock.calls[1][1];
    expect(fallbackArgs).toEqual(
      expect.arrayContaining(["--permission-mode", "dontAsk", "--tools", ""]),
    );
    expect(fallbackArgs).not.toContain("--max-turns");
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

  it("invoke surfaces retry timeout as usage error", async () => {
    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          subtype: "error_max_turns",
          stop_reason: "max_turns",
          result: "",
          structured_output: { findings: [] },
        }),
        stderr: "max turns on first attempt",
        exitCode: 0,
        signal: null,
        durationMs: 200,
      })
      .mockRejectedValueOnce(new CommandTimeoutError('"claude" "-p" "..."', 180_000));

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toThrow(
      "deep audit failed with Claude Code: timed out after 180000ms",
    );
  });

  it("invoke throws when no valid findings are returned", async () => {
    runCommandMock
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          subtype: "error_max_turns",
          stop_reason: "max_turns",
          result: { message: "No findings in turn-capped response" },
          structured_output: { findings: [] },
        }),
        stderr: "max turns on first attempt",
        exitCode: 0,
        signal: null,
        durationMs: 200,
      })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          subtype: "error_max_turns",
          stop_reason: "max_turns",
          result: "",
          structured_output: { findings: [] },
        }),
        stderr: "max turns on retry",
        exitCode: 0,
        signal: null,
        durationMs: 200,
      });

    const adapter = new ClaudeCodeAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toThrow(
      'no valid findings after retry (initial: subtype=error_max_turns; stop_reason=max_turns; result="{\\"message\\":\\"No findings in turn-capped response\\"}"; stderr="max turns on first attempt" | retry: subtype=error_max_turns; stop_reason=max_turns; result=empty; stderr="max turns on retry")',
    );
  });
});
