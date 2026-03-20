import { describe, it, expect, beforeAll } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { existsSync, rmSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI = resolve(__dirname, "../dist/cli.js");
const FIXTURES = resolve(__dirname, "../fixtures");

function run(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: "utf-8" });
  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    status: result.status ?? 1,
  };
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

  it("invalid --tool exits 2", () => {
    const { stderr, status } = run(["audit", ".", "--tool", "not-a-tool"]);
    expect(status).toBe(2);
    expect(stderr).toContain("--tool must be one of");
  });

  // ── Text output: minimal fixture ────────────────────────────────────────

  it("audit fixtures/minimal produces low score terminal output", () => {
    const { stdout, status } = run(["audit", resolve(FIXTURES, "minimal")]);
    expect(status).toBe(0);
    expect(stdout).toContain("Agent Harness Score");
    expect(stdout).toContain("NOT READY");
    expect(stdout).toContain("Instructions");
    expect(stdout).toContain("Context");
    expect(stdout).toContain("Tooling");
    expect(stdout).toContain("Feedback");
    expect(stdout).toContain("Safety");
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
  });

  it("strong fixture scores high (above 80/100)", () => {
    const { stdout } = run(["audit", resolve(FIXTURES, "strong")]);
    const match = stdout.match(/Agent Harness Score:\s*(\d+)\s*\/\s*100/);
    expect(match).not.toBeNull();
    const score = parseInt(match![1], 10);
    expect(score).toBeGreaterThan(80);
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
    expect(report).toHaveProperty("version");
    expect(report).toHaveProperty("generatedAt");
    expect(report).toHaveProperty("input");
    expect(report).toHaveProperty("evidence");
    expect(report).toHaveProperty("scoring");
    expect(report.scoring).toHaveProperty("overallScore");
    expect(report.scoring).toHaveProperty("categoryScores");
    expect(report.scoring).toHaveProperty("topBlockers");
    expect(typeof report.scoring.overallScore).toBe("number");
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

  // ── --write-artifacts ────────────────────────────────────────────────────

  it("--write-artifacts creates generated files in target dir", () => {
    const tmpDir = mkdtempSync(resolve(tmpdir(), "harness-artifacts-cli-"));
    try {
      const { status } = run(["audit", tmpDir, "--write-artifacts"]);
      expect(status).toBe(0);
      expect(existsSync(resolve(tmpDir, "AGENTS.generated.md"))).toBe(true);
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
    expect(report.artifacts.length).toBe(3);
    expect(report.artifacts[0]).toHaveProperty("content");
    expect(typeof report.artifacts[0].content).toBe("string");
    expect(report.artifacts[0].content.length).toBeGreaterThan(0);
  });
});
