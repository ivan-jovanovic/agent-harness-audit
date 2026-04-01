import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  existsSync,
  rmSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  chmodSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "../dist/cli.js");
const FIXTURES = resolve(__dirname, "../fixtures");

function run(
  args: string[],
  envOverrides?: Record<string, string>
): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ...(envOverrides ?? {}) },
  });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
}

function createFakeClaudeBin(
  rootDir: string,
  response: Record<string, unknown> = {
    structured_output: {
      findings: [
        {
          checkId: "has_primary_instructions",
          passed: true,
          evidence: "Deep agent found repo instructions",
        },
      ],
    },
    usage: { total_tokens: 123 },
    total_cost_usd: 0.001,
  },
): string {
  const binDir = resolve(rootDir, "bin");
  const claudePath = resolve(binDir, "claude");
  const responseBody = JSON.stringify(response).replaceAll("'", "'\"'\"'");
  rmSync(binDir, { recursive: true, force: true });
  mkdirSync(binDir, { recursive: true });
  writeFileSync(
    claudePath,
    `#!/bin/sh
if [ "$1" = "--version" ]; then
  echo "claude 0.0.0"
  exit 0
fi
printf '%s\n' '${responseBody}'
exit 0
`,
    "utf-8"
  );
  chmodSync(claudePath, 0o755);
  return binDir;
}

describe("CLI integration", () => {
  beforeAll(() => {
    if (!existsSync(CLI)) {
      throw new Error(`dist/cli.js not found — run 'npm run build' first`);
    }
  });

  // ── --help / --version ───────────────────────────────────────────────────

  it("--help prints usage and exits 0", () => {
    const { stdout, status } = run(["--help"]);
    expect(status).toBe(0);
    expect(stdout).toContain("Usage: agent-harness");
    expect(stdout).toContain("audit <path>");
    expect(stdout).toContain("--json");
    expect(stdout).toContain("--tools");
    expect(stdout).toContain("--deep");
    expect(stdout).toContain("--tokens");
    expect(stdout).toContain("--no-color");
  });

  it("--version prints version and exits 0", () => {
    const { stdout, status } = run(["--version"]);
    expect(status).toBe(0);
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/);
  });

  // ── Error cases ──────────────────────────────────────────────────────────

  it("no command exits 2", () => {
    const { stderr, status } = run([]);
    expect(status).toBe(2);
    expect(stderr).toContain("no command specified");
  });

  it("unknown command exits 2", () => {
    const { stderr, status } = run(["badcmd"]);
    expect(status).toBe(2);
    expect(stderr).toContain('unknown command "badcmd"');
  });

  it("bad path exits 2", () => {
    const { stderr, status } = run(["audit", "/nonexistent/path/that/does/not/exist"]);
    expect(status).toBe(2);
    expect(stderr).toContain("path not found");
  });

  it("--output without --json exits 2", () => {
    const { stderr, status } = run(["audit", ".", "--output", "report.json"]);
    expect(status).toBe(2);
    expect(stderr).toContain("--output requires --json");
  });

  it("invalid --tools exits 2", () => {
    const { stderr, status } = run(["audit", ".", "--tools", "not-a-tool"]);
    expect(status).toBe(2);
    expect(stderr).toContain("--tools must be one of");
  });

  it("invalid --tools in --json emits a machine-readable error envelope", () => {
    const { stdout, stderr, status } = run(["audit", ".", "--json", "--tools", "not-a-tool"]);
    expect(status).toBe(2);
    expect(stderr).toBe("");
    const envelope = JSON.parse(stdout) as {
      error: { code: string; message: string; agent?: string };
    };
    expect(envelope.error.code).toBe("usage_error");
    expect(envelope.error.message).toContain("--tools must be one of");
    expect(envelope.error.agent).toBeUndefined();
  });

  it("unexpected errors in --json emit a machine-readable error envelope", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-unexpected-json-"));
    const outputDir = resolve(tmpDir, "claude-codex-trap");
    mkdirSync(outputDir, { recursive: true });
    chmodSync(outputDir, 0o555);
    try {
      const { stdout, stderr, status } = run([
        "audit",
        resolve(FIXTURES, "minimal"),
        "--json",
        "--output",
        resolve(outputDir, "report.json"),
      ]);
      expect(status).toBe(3);
      expect(stderr).toBe("");
      const envelope = JSON.parse(stdout) as {
        error: { code: string; message: string; agent?: string };
      };
      expect(envelope.error.code).toBe("unexpected_error");
      expect(envelope.error.message).toMatch(/(permission denied|EACCES|EPERM)/i);
      expect(envelope.error.agent).toBeUndefined();
    } finally {
      chmodSync(outputDir, 0o755);
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--tool alias still works and warns", () => {
    const { stderr, status } = run(["audit", resolve(FIXTURES, "minimal"), "--tool", "claude-code", "--json"]);
    expect(status).toBe(0);
    expect(stderr).toContain("deprecated");
  });

  // ── Text output: minimal fixture ────────────────────────────────────────

  it("audit fixtures/minimal produces low score terminal output", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "minimal")]);
    expect(status).toBe(0);
    expect(stdout).toContain("Agent Harness Score");
    expect(stdout).toContain("Readiness Level: L1 Bootstrap");
    expect(stdout).toContain("Now");
    expect(stdout).toContain("Next");
    expect(stdout).toContain("Later");
    expect(stdout).toContain("This audit scores what agents need to work safely in-repo");
    expect(stdout).toContain("understand the repo, scope changes, or verify results");
    expect(stdout).toContain("NOT READY");
    expect(stdout).toContain("Instructions");
    expect(stdout).toContain("Context");
    expect(stdout).toContain("Tooling");
    expect(stdout).toContain("Feedback");
    expect(stdout).toContain("Safety");
    expect(stdout).toContain("Target tools: all");
    expect(stdout).toContain("Tool-Specific Readiness");
  });

  it("caps level-1 Now recommendations and shows overflow count", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "minimal")]);
    expect(status).toBe(0);

    const lines = stdout.split("\n");
    const nowIndex = lines.findIndex((line) => line.trim() === "Now");
    const nextIndex = lines.findIndex((line) => line.trim() === "Next");
    expect(nowIndex).toBeGreaterThanOrEqual(0);
    expect(nextIndex).toBeGreaterThan(nowIndex);

    const nowSection = lines.slice(nowIndex + 1, nextIndex);
    const nowBullets = nowSection.filter((line) => line.trim().startsWith("- "));
    expect(nowBullets).toHaveLength(3);
    expect(nowSection.some((line) => line.includes("+2 more"))).toBe(true);
  });

  it("category Missing: lines do not include 'present' or 'exists' suffix (THU-89)", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "minimal")]);
    const missingLines = stdout.split("\n").filter((l) => l.includes("Missing:"));
    expect(missingLines.length).toBeGreaterThan(0);
    for (const line of missingLines) {
      const afterMissing = line.slice(line.indexOf("Missing:") + "Missing:".length);
      expect(afterMissing).not.toMatch(/\bpresent\b/i);
      expect(afterMissing).not.toMatch(/\bexists?\b/i);
    }
  });

  it("minimal fixture scores very low (under 20/100)", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "minimal")]);
    const match = stdout.match(/Agent Harness Score:\s*(\d+)\s*\/\s*100/);
    expect(match).not.toBeNull();
    const score = parseInt(match![1], 10);
    expect(score).toBeLessThan(20);
  });

  // ── Text output: strong fixture ─────────────────────────────────────────

  it("audit fixtures/strong produces high score terminal output", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "strong")]);
    expect(status).toBe(0);
    expect(stdout).toContain("Agent Harness Score");
    expect(stdout).toContain("READY");
    expect(stdout).toContain("No tool-specific issues detected");
  });

  it("strong fixture scores high (above 80/100)", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "strong")]);
    const match = stdout.match(/Agent Harness Score:\s*(\d+)\s*\/\s*100/);
    expect(match).not.toBeNull();
    const score = parseInt(match![1], 10);
    expect(score).toBeGreaterThan(80);
  });

  it("autonomous fixture renders level-4 optional improvements without a Next section", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "autonomous")]);
    expect(status).toBe(0);
    expect(stdout).toContain("Readiness Level: L4 Autonomous-Ready");
    expect(stdout).toContain("Optional improvements");
    expect(stdout).not.toContain("Next target:");
    expect(stdout.split("\n").map((line) => line.trim())).not.toContain("Next");
  });

  // ── JSON output ──────────────────────────────────────────────────────────

  it("--json flag produces valid parseable JSON", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "minimal"), "--json"]);
    expect(status).toBe(0);
    expect(() => JSON.parse(stdout)).not.toThrow();
  });

  it("--json output conforms to report schema", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "minimal"), "--json"]);
    const report = JSON.parse(stdout);
    expect(report.version).toBe("2");
    expect(report).toHaveProperty("generatedAt");
    expect(report).toHaveProperty("input");
    expect(report).toHaveProperty("evidence");
    expect(report).toHaveProperty("scoring");
    expect(report).toHaveProperty("level");
    expect(report.scoring).toHaveProperty("overallScore");
    expect(report.scoring).toHaveProperty("categoryScores");
    expect(report.scoring).toHaveProperty("topBlockers");
    expect(report.scoring).toHaveProperty("toolReadiness");
    expect(report.scoring).toHaveProperty("toolSpecificFixes");
    expect(typeof report.scoring.overallScore).toBe("number");
    expect(report.level).toHaveProperty("id");
    expect(report.level).toHaveProperty("label");
    expect(report.level).toHaveProperty("blockingGateSet");
    expect(report.level).toHaveProperty("failedHardGates");
    expect(report.level).toHaveProperty("stagedFixes");
    expect(report.level.stagedFixes).toHaveProperty("now");
    expect(report.level.stagedFixes).toHaveProperty("next");
    expect(report.level.stagedFixes).toHaveProperty("later");
    expect(report.input.toolsRequested).toBe("all");
    expect(report.input.toolsResolved).toEqual(
      expect.arrayContaining(["claude-code", "codex", "cursor", "copilot", "other"]),
    );
  });

  it("autonomous --json reports terminal level metadata with empty stagedFixes.next", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "autonomous"), "--json"]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.level.id).toBe(4);
    expect(report.level.nextLevelId).toBeUndefined();
    expect(report.level.stagedFixes.next).toEqual([]);
    expect(Array.isArray(report.level.stagedFixes.later)).toBe(true);
  });

  it("--json output does not contain terminal colour codes", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "minimal"), "--json"]);
    // ESC character should not appear in clean JSON
    expect(stdout).not.toContain("\u001b[");
  });

  it("--json --output writes JSON to file", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-test-"));
    const outFile = resolve(tmpDir, "report.json");

    try {
      const { status, stdout } = run([
        "audit",
        resolve(FIXTURES, "minimal"),
        "--json",
        "--output",
        outFile,
      ]);
      expect(status).toBe(0);
      expect(stdout).toContain("Report written to");
      expect(existsSync(outFile)).toBe(true);

      const content = readFileSync(outFile, "utf-8");
      expect(() => JSON.parse(content)).not.toThrow();
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--tools can narrow the target set in JSON output", () => {
    const { stdout, status } = run([
      "audit",
      resolve(FIXTURES, "minimal"),
      "--json",
      "--tools",
      "claude-code,codex",
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.input.toolsRequested).toEqual(["claude-code", "codex"]);
    expect(report.input.toolsResolved).toEqual(["claude-code", "codex"]);
    expect(report.scoring.toolReadiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "claude-code", status: "needs-work" }),
        expect.objectContaining({ tool: "codex" }),
      ]),
    );
  });

  it("--json output includes tool-specific fixes when Claude is missing", () => {
    const { stdout, status } = run([
      "audit",
      resolve(FIXTURES, "minimal"),
      "--json",
      "--tools",
      "claude-code",
    ]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.scoring.toolSpecificFixes.length).toBeGreaterThanOrEqual(1);
    expect(report.scoring.toolSpecificFixes.some((item: { checkId?: string }) => item.checkId === "has_claude_md")).toBe(true);
  });

  it("--json output includes tool readiness entries for the default all-tools audit", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "minimal"), "--json"]);
    const report = JSON.parse(stdout);
    expect(report.scoring.toolReadiness).toHaveLength(5);
    expect(report.scoring.toolReadiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "claude-code", status: "needs-work" }),
        expect.objectContaining({ tool: "codex", status: "not-scored" }),
      ]),
    );
    expect(report.scoring.toolReadiness.some((item: { tool?: string; status?: string }) => item.tool === "claude-code" && item.status === "needs-work")).toBe(true);
  });

  it("--deep --json includes deepAudit when an agent is available", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-deep-"));
    const binDir = createFakeClaudeBin(tmpDir, {
      structured_output: {
        findings: [
          {
            checkId: "has_primary_instructions",
            passed: true,
            evidence: "Deep agent found repo instructions",
          },
        ],
        strengths: ["Clear repo-level instructions"],
        risks: ["Validation loop is still narrow"],
        autonomyBlockers: ["Missing environment bootstrap notes"],
      },
      usage: { total_tokens: 123 },
      total_cost_usd: 0.001,
    });
    try {
      const { stdout, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--json", "--deep"],
        { PATH: binDir }
      );
      expect(status).toBe(0);
      const report = JSON.parse(stdout);
      expect(report.input.deep).toBe(true);
      expect(report).toHaveProperty("deepAudit");
      expect(report.deepAudit.agentName).toBe("claude-code");
      expect(Array.isArray(report.deepAudit.findings)).toBe(true);
      expect(report.deepAudit.strengths).toEqual(["Clear repo-level instructions"]);
      expect(report.deepAudit.risks).toEqual(["Validation loop is still narrow"]);
      expect(report.deepAudit.autonomyBlockers).toEqual(["Missing environment bootstrap notes"]);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--deep text output renders deep highlights in stable order when present", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-deep-text-"));
    const binDir = createFakeClaudeBin(tmpDir, {
      structured_output: {
        findings: [
          {
            checkId: "has_primary_instructions",
            passed: true,
            evidence: "Deep agent found repo instructions",
          },
        ],
        strengths: ["Clear repo-level instructions"],
        risks: ["Validation loop is still narrow"],
        autonomyBlockers: ["Missing environment bootstrap notes"],
      },
      usage: { total_tokens: 123 },
      total_cost_usd: 0.001,
    });
    try {
      const { stdout, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--deep"],
        { PATH: binDir }
      );
      expect(status).toBe(0);
      expect(stdout).toContain("Deep Audit Highlights");
      expect(stdout).toContain("Strengths");
      expect(stdout).toContain("- Clear repo-level instructions");
      expect(stdout).toContain("Risks");
      expect(stdout).toContain("- Validation loop is still narrow");
      expect(stdout).toContain("Autonomy Blockers");
      expect(stdout).toContain("- Missing environment bootstrap notes");
      expect(stdout.indexOf("Strengths")).toBeLessThan(stdout.indexOf("Risks"));
      expect(stdout.indexOf("Risks")).toBeLessThan(stdout.indexOf("Autonomy Blockers"));
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--deep text output omits deep highlights when no descriptive fields are present", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-deep-text-empty-"));
    const binDir = createFakeClaudeBin(tmpDir);
    try {
      const { stdout, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--deep"],
        { PATH: binDir }
      );
      expect(status).toBe(0);
      expect(stdout).not.toContain("Deep Audit Highlights");
      expect(stdout).not.toContain("Autonomy Blockers");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--deep exits 2 when no supported agents are available", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-no-agents-"));
    try {
      const { stderr, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--deep"],
        { PATH: tmpDir }
      );
      expect(status).toBe(2);
      expect(stderr).toContain("no supported agent found");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--deep --agent fails when requested agent is unavailable", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-agent-unavailable-"));
    const binDir = createFakeClaudeBin(tmpDir);
    try {
      const { stderr, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--deep", "--agent", "codex"],
        { PATH: binDir }
      );
      expect(status).toBe(2);
      expect(stderr).toContain("requested agent is not available: codex");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--deep --agent in --json emits agent on the error envelope", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-agent-unavailable-json-"));
    const binDir = createFakeClaudeBin(tmpDir);
    try {
      const { stdout, stderr, status } = run(
        ["audit", resolve(FIXTURES, "minimal"), "--json", "--deep", "--agent", "codex"],
        { PATH: binDir }
      );
      expect(status).toBe(2);
      expect(stderr).toBe("");
      const envelope = JSON.parse(stdout) as {
        error: { code: string; message: string; agent?: string };
      };
      expect(envelope.error.code).toBe("usage_error");
      expect(envelope.error.message).toContain("requested agent is not available: codex");
      expect(envelope.error.agent).toBe("codex");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("unexpected error messages containing claude/codex do not misattribute agent", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-agent-trap-"));
    const outputDir = resolve(tmpDir, "claude-codex-json-trap");
    mkdirSync(outputDir, { recursive: true });
    chmodSync(outputDir, 0o555);
    try {
      const { stdout, stderr, status } = run([
        "audit",
        resolve(FIXTURES, "minimal"),
        "--json",
        "--output",
        resolve(outputDir, "report.json"),
      ]);
      expect(status).toBe(3);
      expect(stderr).toBe("");
      const envelope = JSON.parse(stdout) as {
        error: { code: string; message: string; agent?: string };
      };
      expect(envelope.error.code).toBe("unexpected_error");
      expect(envelope.error.message).toMatch(/claude-codex-json-trap/);
      expect(envelope.error.agent).toBeUndefined();
    } finally {
      chmodSync(outputDir, 0o755);
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  // ── --write-artifacts ────────────────────────────────────────────────────

  it("--write-artifacts creates generated files in target dir", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-artifacts-cli-"));
    try {
      const { status } = run(["audit", tmpDir, "--write-artifacts"]);
      expect(status).toBe(0);
      expect(existsSync(resolve(tmpDir, "AGENTS.generated.md"))).toBe(true);
      expect(existsSync(resolve(tmpDir, "CLAUDE.generated.md"))).toBe(true);
      expect(existsSync(resolve(tmpDir, "validation-checklist.generated.md"))).toBe(true);
      expect(existsSync(resolve(tmpDir, "architecture-outline.generated.md"))).toBe(true);
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--write-artifacts does not overwrite existing AGENTS.md", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-artifacts-guard-"));
    try {
      writeFileSync(resolve(tmpDir, "AGENTS.md"), "# keep me");
      const { status } = run(["audit", tmpDir, "--write-artifacts"]);
      expect(status).toBe(0);
      // AGENTS.generated.md should NOT be created
      expect(existsSync(resolve(tmpDir, "AGENTS.generated.md"))).toBe(false);
      // Original file should be unchanged
      expect(readFileSync(resolve(tmpDir, "AGENTS.md"), "utf-8")).toBe("# keep me");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("--json output includes artifacts array with content", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "minimal"), "--json"]);
    expect(status).toBe(0);
    const report = JSON.parse(stdout);
    expect(report).toHaveProperty("artifacts");
    expect(Array.isArray(report.artifacts)).toBe(true);
    expect(report.artifacts.length).toBe(4);
    expect(report.artifacts[0]).toHaveProperty("content");
    expect(typeof report.artifacts[0].content).toBe("string");
    expect(report.artifacts[0].content.length).toBeGreaterThan(0);
  });
});
