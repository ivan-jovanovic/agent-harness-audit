import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentAdapter } from "./adapter.js";
import { runCommand } from "./command.js";
import { parseJsonWithFallback } from "./parsing.js";
import { DEEP_CHECK_IDS, DEEP_CHECK_METADATA } from "./checks.js";
import type { AgentName, DeepAuditFinding, DeepAuditResult, RepoEvidence } from "../types.js";
import { AuditUsageError } from "../types.js";

const CODEX_DETECT_TIMEOUT_MS = 2_000;
const CODEX_INVOKE_TIMEOUT_MS = 60_000;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          checkId: { type: "string" },
          passed: { type: "boolean" },
          evidence: { type: "string" },
          failureNote: { type: "string" },
        },
        required: ["checkId", "passed", "evidence"],
        additionalProperties: true,
      },
    },
  },
  required: ["findings"],
  additionalProperties: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.round(prompt.length / 4));
}

function buildPrompt(projectPath: string, evidence: RepoEvidence): string {
  return [
    "You are performing a deep verification pass for an AI-agent-readiness audit of a software repository.",
    "",
    "Goal:",
    "Assess whether this repository is ready for autonomous coding agents by checking if it provides:",
    "1) clear operating instructions,",
    "2) discoverable technical context,",
    "3) runnable tooling/validation loops,",
    "4) basic safety/setup guardrails.",
    "",
    "Important:",
    "- Use ONLY the evidence provided below.",
    "- Do NOT assume missing information.",
    "- If evidence is ambiguous or absent, mark the check as passed=false.",
    "- Be strict and repo-specific; avoid generic statements.",
    "- This step does NOT compute score/weights; it only evaluates checks.",
    "",
    "Repository:",
    `Repo path: ${projectPath}`,
    "",
    "Pre-collected signals (heuristic layer):",
    JSON.stringify(evidence, null, 2),
    "",
    "Evaluate each check ID below. For each check return:",
    "- passed: boolean",
    "- evidence: one sentence with concrete repo-specific proof (or absence)",
    "- failureNote: optional short remediation-oriented note when passed=false",
    "",
    "Check IDs:",
    "",
    DEEP_CHECK_IDS.join("\n"),
    "",
    "Check intent guide:",
    "- has_primary_instructions: primary agent instructions (for example AGENTS.md or CLAUDE.md) exist and are usable.",
    "- has_readme: meaningful README exists at expected root/docs location.",
    "- has_generic_skills: reusable generic skills/prompts exist.",
    "- has_tool_skills: tool-specific skills exist for targeted agent ecosystems.",
    "- has_architecture_docs: architecture/system/repo-structure docs are discoverable.",
    "- has_docs_index: a docs index such as docs/index.md or docs/README.md exists.",
    "- has_docs_dir: docs directory exists and is usable.",
    "- has_tsconfig: TypeScript config exists when TS context is expected.",
    "- has_env_example: .env.example (or equivalent) exists with required keys.",
    "- has_package_json: package.json exists at audit scope root.",
    "- has_lockfile: dependency lockfile exists.",
    "- has_lint_script: lint script exists in package scripts.",
    "- has_typecheck_script: typecheck script exists in package scripts.",
    "- has_build_script: build script exists in package scripts.",
    "- has_test_script: test script exists in package scripts.",
    "- has_test_dir: test directory exists.",
    "- has_test_files: at least one test file exists.",
    "",
    "Respond ONLY with JSON matching the output schema.",
  ].join("\n");
}

function normalizeFindings(payload: unknown): DeepAuditFinding[] {
  const rawFindings = (() => {
    if (Array.isArray(payload)) return payload;
    if (isRecord(payload) && Array.isArray(payload.findings)) return payload.findings;
    return [];
  })();

  const findings: DeepAuditFinding[] = [];
  for (const item of rawFindings) {
    if (!isRecord(item)) continue;
    const checkId = item.checkId;
    const passed = item.passed;
    if (typeof checkId !== "string" || typeof passed !== "boolean") continue;

    const meta = DEEP_CHECK_METADATA[checkId];
    if (!meta) continue;

    findings.push({
      categoryId: meta.categoryId,
      checkId,
      passed,
      label: meta.label,
      evidence: typeof item.evidence === "string" ? item.evidence : "",
      failureNote: typeof item.failureNote === "string" ? item.failureNote : undefined,
    });
  }

  return findings;
}

function parseCodexJsonl(stdout: string): unknown | null {
  let lastPayload: unknown = null;
  const lines = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    const event = parseJsonWithFallback<unknown>(line);
    if (!isRecord(event)) continue;

    if ("structured_output" in event) {
      lastPayload = event.structured_output;
      continue;
    }

    if (event.type === "agent_message" && typeof event.text === "string") {
      const parsed = parseJsonWithFallback<unknown>(event.text);
      if (parsed !== null) lastPayload = parsed;
      continue;
    }

    if (
      event.type === "item.completed" &&
      isRecord(event.item) &&
      event.item.type === "agent_message" &&
      typeof event.item.text === "string"
    ) {
      const parsed = parseJsonWithFallback<unknown>(event.item.text);
      if (parsed !== null) lastPayload = parsed;
      continue;
    }
  }

  return lastPayload;
}

export class CodexAdapter implements AgentAdapter {
  name: AgentName = "codex";

  async detect(): Promise<boolean> {
    try {
      const result = await runCommand("codex", ["--version"], {
        timeoutMs: CODEX_DETECT_TIMEOUT_MS,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult> {
    const prompt = buildPrompt(projectPath, evidence);
    const tokenEstimate = estimateTokens(prompt);
    const tmpRoot = await mkdtemp(join(tmpdir(), "agent-harness-codex-"));
    const schemaPath = join(tmpRoot, "schema.json");
    const outputPath = join(tmpRoot, "last-message.json");

    await writeFile(schemaPath, JSON.stringify(OUTPUT_SCHEMA), "utf-8");

    try {
      const result = await runCommand(
        "codex",
        [
          "exec",
          prompt,
          "--json",
          "--sandbox",
          "read-only",
          "--output-schema",
          schemaPath,
          "--output-last-message",
          outputPath,
        ],
        {
          cwd: projectPath,
          timeoutMs: CODEX_INVOKE_TIMEOUT_MS,
        },
      );

      if (result.exitCode !== 0) {
        throw new AuditUsageError(
          `deep audit failed with Codex (exit ${result.exitCode ?? "unknown"}): ${result.stderr.trim() || "no stderr output"}`,
        );
      }

      let payload: unknown | null = null;
      try {
        const fromFile = await readFile(outputPath, "utf-8");
        payload = parseJsonWithFallback<unknown>(fromFile);
      } catch {
        payload = null;
      }

      if (payload === null) {
        payload = parseCodexJsonl(result.stdout);
      }

      if (payload === null) {
        throw new AuditUsageError("deep audit failed: Codex returned no parseable payload");
      }

      const findings = normalizeFindings(payload);
      if (findings.length === 0) {
        throw new AuditUsageError("deep audit failed: Codex returned no valid findings");
      }

      return {
        agentName: this.name,
        findings,
        tokenEstimate,
        tokensActual: 0,
        costEstimateUsd: 0,
        costActualUsd: 0,
        durationMs: result.durationMs,
        rawResponse: result.stdout,
      };
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }
}
