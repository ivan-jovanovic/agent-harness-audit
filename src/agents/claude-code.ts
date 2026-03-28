import type { AgentAdapter } from "./adapter.js";
import { CommandTimeoutError, runCommand } from "./command.js";
import { parseJsonWithFallback, tryParseJson } from "./parsing.js";
import { DEEP_CHECK_IDS, DEEP_CHECK_METADATA } from "./checks.js";
import type { AgentName, DeepAuditFinding, DeepAuditResult, RepoEvidence } from "../types.js";
import { AuditUsageError } from "../types.js";

const CLAUDE_DETECT_TIMEOUT_MS = 2_000;
const CLAUDE_INVOKE_TIMEOUT_MS = 180_000;
const CLAUDE_HARDENED_ENV: NodeJS.ProcessEnv = {
  GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=5",
  GIT_TERMINAL_PROMPT: "0",
};

const RESPONSE_SCHEMA = JSON.stringify({
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
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return undefined;
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
    "Respond ONLY with JSON matching the provided schema.",
  ].join("\n");
}

function extractPayload(envelope: unknown): unknown {
  if (!isRecord(envelope)) {
    return envelope;
  }

  if ("structured_output" in envelope) {
    return envelope.structured_output;
  }

  if ("result" in envelope) {
    const result = envelope.result;
    if (typeof result === "string") {
      return parseJsonWithFallback<unknown>(result) ?? result;
    }
    return result;
  }

  return envelope;
}

function normalizeFindings(payload: unknown): DeepAuditFinding[] {
  const rawFindings = (() => {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (isRecord(payload) && Array.isArray(payload.findings)) {
      return payload.findings;
    }
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

function readTokensActual(envelope: unknown): number {
  if (!isRecord(envelope) || !isRecord(envelope.usage)) {
    return 0;
  }
  const total = toNumber(envelope.usage.total_tokens);
  if (total !== undefined) return total;

  const input = toNumber(envelope.usage.input_tokens) ?? 0;
  const output = toNumber(envelope.usage.output_tokens) ?? 0;
  return input + output;
}

function readCostActual(envelope: unknown): number {
  if (!isRecord(envelope)) return 0;
  return toNumber(envelope.total_cost_usd) ?? 0;
}

export class ClaudeCodeAdapter implements AgentAdapter {
  name: AgentName = "claude-code";

  async detect(): Promise<boolean> {
    try {
      const result = await runCommand("claude", ["--version"], {
        timeoutMs: CLAUDE_DETECT_TIMEOUT_MS,
        env: CLAUDE_HARDENED_ENV,
      });
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  async invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult> {
    const prompt = buildPrompt(projectPath, evidence);
    const tokenEstimate = estimateTokens(prompt);
    let result;
    try {
      result = await runCommand(
        "claude",
        [
          "-p",
          prompt,
          "--output-format",
          "json",
          "--json-schema",
          RESPONSE_SCHEMA,
          "--permission-mode",
          "dontAsk",
          "--tools",
          "",
        ],
        {
          cwd: projectPath,
          timeoutMs: CLAUDE_INVOKE_TIMEOUT_MS,
          env: CLAUDE_HARDENED_ENV,
        },
      );
    } catch (error) {
      if (error instanceof CommandTimeoutError) {
        throw new AuditUsageError(
          `deep audit failed with Claude Code: timed out after ${CLAUDE_INVOKE_TIMEOUT_MS}ms (try again with --agent codex as fallback)`,
        );
      }
      throw error;
    }

    if (result.exitCode !== 0) {
      const detail = result.stderr.trim() || result.stdout.trim() || "no output";
      throw new AuditUsageError(
        `deep audit failed with Claude Code (exit ${result.exitCode ?? "unknown"}): ${detail}`,
      );
    }

    const envelope = tryParseJson<unknown>(result.stdout);
    if (envelope === null) {
      throw new AuditUsageError("deep audit failed: Claude response was not valid JSON");
    }

    const payload = extractPayload(envelope);
    const findings = normalizeFindings(payload);
    if (findings.length === 0) {
      throw new AuditUsageError("deep audit failed: Claude returned no valid findings");
    }

    return {
      agentName: this.name,
      findings,
      tokenEstimate,
      tokensActual: readTokensActual(envelope),
      costEstimateUsd: 0,
      costActualUsd: readCostActual(envelope),
      durationMs: result.durationMs,
      rawResponse: result.stdout,
    };
  }
}
