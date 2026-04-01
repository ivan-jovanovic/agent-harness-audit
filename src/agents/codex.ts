import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { AgentAdapter } from "./adapter.js";
import { CommandTimeoutError, runCommand } from "./command.js";
import { normalizeDeepAuditPayload, parseJsonWithFallback } from "./parsing.js";
import { buildDeepAuditPrompt, estimateDeepPromptTokens } from "./deep-prompt.js";
import type {
  AgentName,
  DeepAuditContext,
  DeepAuditResult,
  RepoEvidence,
} from "../types.js";
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
    strengths: {
      type: "array",
      items: { type: "string" },
    },
    risks: {
      type: "array",
      items: { type: "string" },
    },
    autonomyBlockers: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["findings"],
  additionalProperties: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
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

  async invoke(
    projectPath: string,
    evidence: RepoEvidence,
    context?: DeepAuditContext,
  ): Promise<DeepAuditResult> {
    const prompt = buildDeepAuditPrompt(projectPath, evidence, context);
    const tokenEstimate = estimateDeepPromptTokens(projectPath, evidence, context);
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
          this.name,
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
        throw new AuditUsageError("deep audit failed: Codex returned no parseable payload", this.name);
      }

      const normalized = normalizeDeepAuditPayload(payload);
      const { findings } = normalized;
      if (findings.length === 0) {
        throw new AuditUsageError("deep audit failed: Codex returned no valid findings", this.name);
      }

      return {
        agentName: this.name,
        findings,
        strengths: normalized.strengths,
        risks: normalized.risks,
        autonomyBlockers: normalized.autonomyBlockers,
        tokenEstimate,
        tokensActual: 0,
        costEstimateUsd: 0,
        costActualUsd: 0,
        durationMs: result.durationMs,
        rawResponse: result.stdout,
      };
    } catch (error) {
      if (error instanceof CommandTimeoutError) {
        throw new AuditUsageError(
          `deep audit failed with Codex: timed out after ${CODEX_INVOKE_TIMEOUT_MS}ms`,
          this.name,
        );
      }
      throw error;
    } finally {
      await rm(tmpRoot, { recursive: true, force: true });
    }
  }
}
