import { describe, expect, it } from "vitest";

import { normalizeDeepAuditPayload } from "../../src/agents/parsing.js";

describe("normalizeDeepAuditPayload", () => {
  it("preserves level-only deep findings via metadata map", () => {
    const payload = {
      findings: [
        {
          checkId: "has_execution_plans",
          passed: true,
          evidence: "Found docs/plans/q3.md",
        },
        {
          checkId: "has_short_navigational_instructions",
          passed: true,
          evidence: "AGENTS.md points to docs/index.md",
        },
        {
          checkId: "has_observability_signals",
          passed: false,
          evidence: "No telemetry deps found",
          failureNote: "Add observability signals",
        },
        {
          checkId: "has_quality_or_debt_tracking",
          passed: true,
          evidence: "Found docs/maintenance/todo.md",
        },
        {
          checkId: "unknown_check",
          passed: true,
          evidence: "ignore me",
        },
      ],
    };

    const normalized = normalizeDeepAuditPayload(payload);
    expect(normalized.findings.map((finding) => finding.checkId)).toEqual([
      "has_execution_plans",
      "has_short_navigational_instructions",
      "has_observability_signals",
      "has_quality_or_debt_tracking",
    ]);
    expect(normalized.findings.find((finding) => finding.checkId === "has_execution_plans")?.categoryId).toBe(
      "context",
    );
    expect(
      normalized.findings.find((finding) => finding.checkId === "has_short_navigational_instructions")?.categoryId,
    ).toBe("instructions");
    expect(normalized.findings.find((finding) => finding.checkId === "has_observability_signals")?.categoryId).toBe(
      "safety",
    );
    expect(
      normalized.findings.find((finding) => finding.checkId === "has_quality_or_debt_tracking")?.categoryId,
    ).toBe("safety");
  });
});
