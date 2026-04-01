import { DEEP_CHECK_METADATA } from "./checks.js";
import type { DeepAuditFinding, DeepAuditResult } from "../types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function tryParseJson<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function extractFirstJsonBlock(raw: string): string | null {
  let start = -1;
  let openChar = "";
  let closeChar = "";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (start === -1 && (ch === "{" || ch === "[")) {
      start = i;
      openChar = ch;
      closeChar = ch === "{" ? "}" : "]";
      depth = 1;
      continue;
    }

    if (start === -1) continue;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }

    if (ch === "\"") {
      inString = true;
      continue;
    }

    if (ch === openChar) {
      depth += 1;
      continue;
    }

    if (ch === closeChar) {
      depth -= 1;
      if (depth === 0 && start !== -1) {
        return raw.slice(start, i + 1);
      }
    }
  }

  return null;
}

export function parseJsonWithFallback<T>(raw: string): T | null {
  const direct = tryParseJson<T>(raw);
  if (direct !== null) return direct;

  const block = extractFirstJsonBlock(raw);
  if (!block) return null;

  return tryParseJson<T>(block);
}

export function extractPayloadFromEnvelope(envelope: unknown): unknown {
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

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  return value.filter((item): item is string => typeof item === "string");
}

export function normalizeDeepAuditPayload(
  payload: unknown,
): Pick<DeepAuditResult, "findings" | "strengths" | "risks" | "autonomyBlockers"> {
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

  return {
    findings,
    strengths: isRecord(payload) ? normalizeStringArray(payload.strengths) : undefined,
    risks: isRecord(payload) ? normalizeStringArray(payload.risks) : undefined,
    autonomyBlockers: isRecord(payload) ? normalizeStringArray(payload.autonomyBlockers) : undefined,
  };
}
