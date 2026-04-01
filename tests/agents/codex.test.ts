import { writeFile } from "node:fs/promises";
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

import { CodexAdapter } from "../../src/agents/codex.js";
import { runCommand } from "../../src/agents/command.js";
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
      kind: "docs-index",
      title: "docs/index.md",
      path: "/repo/docs/index.md",
      content: "# docs",
      truncated: false,
    },
  ],
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
          strengths: ["Runnable test command exists"],
          risks: ["No CI validation evidence in prompt"],
          autonomyBlockers: ["Agent cannot verify deployment steps"],
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
    expect(result.strengths).toEqual(["Runnable test command exists"]);
    expect(result.risks).toEqual(["No CI validation evidence in prompt"]);
    expect(result.autonomyBlockers).toEqual(["Agent cannot verify deployment steps"]);
  });

  it("invoke normalizes command timeouts into a usage error with agent attribution", async () => {
    const { CommandTimeoutError } = await vi.importActual<typeof import("../../src/agents/command.js")>(
      "../../src/agents/command.js",
    );
    runCommandMock.mockRejectedValue(new CommandTimeoutError("codex exec prompt", 60_000));

    const adapter = new CodexAdapter();
    await expect(adapter.invoke(process.cwd(), EVIDENCE)).rejects.toMatchObject({
      name: "AuditUsageError",
      agent: "codex",
    });
  });

  it("invoke includes deep context excerpts in the command payload", async () => {
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
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 220,
      };
    });

    const adapter = new CodexAdapter();
    await adapter.invoke(process.cwd(), EVIDENCE, DEEP_CONTEXT);

    const call = runCommandMock.mock.calls[0];
    const prompt = call[1][1];
    expect(prompt).toContain("Deep context excerpts (deterministic, bounded):");
    expect(prompt).toContain("docs/index.md");
    expect(prompt).toContain("# docs");
  });

  it("invoke accepts array payloads from the last-message file", async () => {
    runCommandMock.mockImplementation(async (_command, args) => {
      const outIndex = args.indexOf("--output-last-message");
      const outPath = args[outIndex + 1];
      await writeFile(
        outPath,
        JSON.stringify([
          {
            checkId: "has_test_script",
            passed: true,
            evidence: "Found a test script in package.json",
          },
        ]),
        "utf-8",
      );

      return {
        stdout: "",
        stderr: "",
        exitCode: 0,
        signal: null,
        durationMs: 220,
      };
    });

    const adapter = new CodexAdapter();
    const result = await adapter.invoke(process.cwd(), EVIDENCE);

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
