import type { AgentAdapter } from "./adapter.js";
import { CommandTimeoutError, runCommand } from "./command.js";
import { extractPayloadFromEnvelope, normalizeDeepAuditPayload, tryParseJson } from "./parsing.js";
import { buildDeepAuditPrompt, estimateDeepPromptTokens } from "./deep-prompt.js";
import type {
  AgentName,
  DeepAuditContext,
  DeepAuditResult,
  RepoEvidence,
} from "../types.js";
import { AuditUsageError } from "../types.js";

const CLAUDE_DETECT_TIMEOUT_MS = 2_000;
const CLAUDE_INVOKE_TIMEOUT_MS = 180_000;
const CLAUDE_HARDENED_ENV: NodeJS.ProcessEnv = {
  GIT_SSH_COMMAND: "ssh -o BatchMode=yes -o ConnectTimeout=5",
  GIT_TERMINAL_PROMPT: "0",
};
const CLAUDE_DIAGNOSTIC_CHARS = 160;

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

interface ClaudeInvokeOptions {
  maxTurns?: number;
}

interface ClaudeEnvelopeDiagnostics {
  subtype?: string;
  stopReason?: string;
  hasStructuredOutput: boolean;
  hasResultField: boolean;
  resultText?: string;
}

interface ClaudeAttempt {
  stdout: string;
  stderr: string;
  durationMs: number;
  envelope: unknown;
  diagnostics: ClaudeEnvelopeDiagnostics;
  normalized: Pick<DeepAuditResult, "findings" | "strengths" | "risks" | "autonomyBlockers">;
}

function readString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function summarizeText(text: string): string | undefined {
  const trimmed = text.trim().replace(/\s+/g, " ");
  if (trimmed.length === 0) {
    return undefined;
  }

  if (trimmed.length <= CLAUDE_DIAGNOSTIC_CHARS) {
    return trimmed;
  }

  return `${trimmed.slice(0, CLAUDE_DIAGNOSTIC_CHARS - 3)}...`;
}

function readClaudeEnvelopeDiagnostics(envelope: unknown): ClaudeEnvelopeDiagnostics {
  if (!isRecord(envelope)) {
    return {
      hasStructuredOutput: false,
      hasResultField: false,
    };
  }

  const resultValue = envelope.result;
  const resultRecord = isRecord(resultValue) ? resultValue : undefined;
  const resultText = (() => {
    if (typeof resultValue === "string") {
      return summarizeText(resultValue);
    }
    if (resultValue === undefined) {
      return undefined;
    }
    if (typeof resultValue === "object" && resultValue !== null) {
      return summarizeText(JSON.stringify(resultValue));
    }
    return summarizeText(String(resultValue));
  })();

  return {
    subtype: readString(envelope.subtype) ?? readString(resultRecord?.subtype),
    stopReason: readString(envelope.stop_reason) ?? readString(resultRecord?.stop_reason),
    hasStructuredOutput: "structured_output" in envelope,
    hasResultField: "result" in envelope,
    resultText,
  };
}

function formatNoFindingsDetail(attempt: ClaudeAttempt): string | null {
  const parts: string[] = [];

  if (attempt.diagnostics.subtype) {
    parts.push(`subtype=${attempt.diagnostics.subtype}`);
  }
  if (attempt.diagnostics.stopReason) {
    parts.push(`stop_reason=${attempt.diagnostics.stopReason}`);
  }
  if (!attempt.diagnostics.hasStructuredOutput) {
    parts.push("structured_output=missing");
  }
  if (attempt.diagnostics.hasResultField) {
    parts.push(attempt.diagnostics.resultText ? `result=${JSON.stringify(attempt.diagnostics.resultText)}` : "result=empty");
  }

  const stderrSummary = summarizeText(attempt.stderr);
  if (stderrSummary) {
    parts.push(`stderr=${JSON.stringify(stderrSummary)}`);
  }

  return parts.length > 0 ? parts.join("; ") : null;
}

function buildNoFindingsMessage(attempt: ClaudeAttempt, initialAttempt?: ClaudeAttempt): string {
  const retryDetail = formatNoFindingsDetail(attempt);
  if (!initialAttempt) {
    return retryDetail
      ? `deep audit failed: Claude returned no valid findings (${retryDetail})`
      : "deep audit failed: Claude returned no valid findings";
  }

  const initialDetail = formatNoFindingsDetail(initialAttempt);
  const parts = [
    initialDetail ? `initial: ${initialDetail}` : null,
    retryDetail ? `retry: ${retryDetail}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0
    ? `deep audit failed: Claude returned no valid findings after retry (${parts.join(" | ")})`
    : "deep audit failed: Claude returned no valid findings after retry";
}

function shouldRetryWithoutTurnLimit(attempt: ClaudeAttempt, options: ClaudeInvokeOptions): boolean {
  return options.maxTurns !== undefined && attempt.normalized.findings.length === 0;
}

function buildClaudeArgs(prompt: string, options: ClaudeInvokeOptions): string[] {
  const args = [
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
  ];

  if (options.maxTurns !== undefined) {
    args.push("--max-turns", String(options.maxTurns));
  }

  return args;
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

  async invoke(
    projectPath: string,
    evidence: RepoEvidence,
    context?: DeepAuditContext,
  ): Promise<DeepAuditResult> {
    const prompt = buildDeepAuditPrompt(projectPath, evidence, context);
    const tokenEstimate = estimateDeepPromptTokens(projectPath, evidence, context);

    const invokeClaude = async (options: ClaudeInvokeOptions): Promise<ClaudeAttempt> => {
      let result;
      try {
        result = await runCommand("claude", buildClaudeArgs(prompt, options), {
          cwd: projectPath,
          timeoutMs: CLAUDE_INVOKE_TIMEOUT_MS,
          env: CLAUDE_HARDENED_ENV,
        });
      } catch (error) {
        if (error instanceof CommandTimeoutError) {
          throw new AuditUsageError(
            `deep audit failed with Claude Code: timed out after ${CLAUDE_INVOKE_TIMEOUT_MS}ms (try again with --agent codex as fallback)`,
            this.name,
          );
        }
        throw error;
      }

      if (result.exitCode !== 0) {
        const detail = result.stderr.trim() || result.stdout.trim() || "no output";
        throw new AuditUsageError(
          `deep audit failed with Claude Code (exit ${result.exitCode ?? "unknown"}): ${detail}`,
          this.name,
        );
      }

      const envelope = tryParseJson<unknown>(result.stdout);
      if (envelope === null) {
        throw new AuditUsageError("deep audit failed: Claude response was not valid JSON", this.name);
      }

      const payload = extractPayloadFromEnvelope(envelope);
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        durationMs: result.durationMs,
        envelope,
        diagnostics: readClaudeEnvelopeDiagnostics(envelope),
        normalized: normalizeDeepAuditPayload(payload),
      };
    };

    const primaryAttempt = await invokeClaude({ maxTurns: 1 });
    if (primaryAttempt.normalized.findings.length > 0) {
      return {
        agentName: this.name,
        findings: primaryAttempt.normalized.findings,
        strengths: primaryAttempt.normalized.strengths,
        risks: primaryAttempt.normalized.risks,
        autonomyBlockers: primaryAttempt.normalized.autonomyBlockers,
        tokenEstimate,
        tokensActual: readTokensActual(primaryAttempt.envelope),
        costEstimateUsd: 0,
        costActualUsd: readCostActual(primaryAttempt.envelope),
        durationMs: primaryAttempt.durationMs,
        rawResponse: primaryAttempt.stdout,
      };
    }

    if (!shouldRetryWithoutTurnLimit(primaryAttempt, { maxTurns: 1 })) {
      throw new AuditUsageError(buildNoFindingsMessage(primaryAttempt), this.name);
    }

    // Retry once without the turn cap to avoid Claude's max-turn envelope regression
    // while keeping the non-interactive hardened settings intact.
    const fallbackAttempt = await invokeClaude({});
    if (fallbackAttempt.normalized.findings.length === 0) {
      throw new AuditUsageError(buildNoFindingsMessage(fallbackAttempt, primaryAttempt), this.name);
    }

    return {
      agentName: this.name,
      findings: fallbackAttempt.normalized.findings,
      strengths: fallbackAttempt.normalized.strengths,
      risks: fallbackAttempt.normalized.risks,
      autonomyBlockers: fallbackAttempt.normalized.autonomyBlockers,
      tokenEstimate,
      tokensActual: readTokensActual(primaryAttempt.envelope) + readTokensActual(fallbackAttempt.envelope),
      costEstimateUsd: 0,
      costActualUsd: readCostActual(primaryAttempt.envelope) + readCostActual(fallbackAttempt.envelope),
      durationMs: primaryAttempt.durationMs + fallbackAttempt.durationMs,
      rawResponse: fallbackAttempt.stdout,
    };
  }
}
