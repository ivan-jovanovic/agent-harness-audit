import type { DeepAuditContext, RepoEvidence } from "../types.js";
import { DEEP_CHECK_IDS } from "./checks.js";

export const MAX_DEEP_PROMPT_CHARS = 12_000;
const DEFAULT_MAX_EVIDENCE_CHARS = 3_500;
const DEFAULT_MAX_CONTEXT_CHARS = 5_000;
const TRUNCATION_NOTE = "... [truncated to keep the deep audit prompt bounded]";

export interface DeepPromptLimits {
  maxPromptChars?: number;
  maxEvidenceChars?: number;
  maxContextChars?: number;
}

function estimateTokens(prompt: string): number {
  return Math.max(1, Math.round(prompt.length / 4));
}

function truncateText(text: string, maxChars: number): { content: string; truncated: boolean } {
  if (maxChars <= 0) {
    return { content: "", truncated: text.length > 0 };
  }

  if (text.length <= maxChars) {
    return { content: text, truncated: false };
  }

  return {
    content: text.slice(0, maxChars),
    truncated: true,
  };
}

function jsonBlockLines(title: string, value: unknown, maxChars: number): string[] {
  if (maxChars <= 0) {
    return [];
  }

  const raw = JSON.stringify(value, null, 2);
  const header = `${title}:`;
  const available = Math.max(0, maxChars - header.length - 1);
  const bounded = truncateText(raw, available);
  const lines = [header];

  if (bounded.content.length > 0) {
    lines.push(...bounded.content.split("\n"));
  }

  if (bounded.truncated) {
    lines.push(TRUNCATION_NOTE);
  }

  return lines;
}

function buildIntentGuideLines(): string[] {
  return [
    "Check intent guide:",
    "- has_primary_instructions: primary agent instructions (for example AGENTS.md or CLAUDE.md) exist and are usable.",
    "- has_readme: meaningful README exists at expected root/docs location.",
    "- has_generic_skills: reusable generic skills/prompts exist.",
    "- has_tool_skills: tool-specific skills exist for targeted agent ecosystems.",
    "- has_architecture_docs: architecture/system/repo-structure docs are discoverable.",
    "- has_docs_index: a docs index such as docs/index.md or docs/README.md exists.",
    "- has_structured_docs: docs/ is organized into topical sections or multiple docs files.",
    "- has_docs_dir: docs directory exists and is usable.",
    "- has_tsconfig: TypeScript config exists when TS context is expected.",
    "- has_env_example: canonical .env.example exists with required environment keys.",
    "- has_package_json: package.json exists at audit scope root.",
    "- has_lockfile: dependency lockfile exists.",
    "- has_architecture_lints: boundary-enforcement tooling such as dependency-cruiser or eslint-plugin-boundaries exists.",
    "- has_local_dev_boot_path: a local dev/start/preview/serve script or equivalent app boot path exists.",
    "- has_lint_script: lint script exists in package scripts.",
    "- has_typecheck_script: typecheck script exists in package scripts.",
    "- has_build_script: build script exists in package scripts.",
    "- has_test_script: test script exists in package scripts.",
    "- has_test_dir: test directory exists.",
    "- has_test_files: at least one test file exists.",
    "- has_e2e_or_smoke_tests: e2e or smoke test signals exist, such as Playwright/Cypress config or an e2e/smoke test directory.",
    "- has_execution_plans: implementation/execution plans are discoverable (for example implementation-plan*.md, plans/, or docs/plans/).",
    "- has_short_navigational_instructions: concise AGENTS.md/CLAUDE.md instructions provide concrete navigation pointers into repo paths/docs.",
    "- has_observability_signals: repository includes observability signals (for example telemetry/logging dependencies or observability files).",
    "- has_quality_or_debt_tracking: repository tracks quality/debt/maintenance work in explicit docs (for example debt/quality/maintenance docs).",
    "- has_ci_pipeline: a CI pipeline file such as .github/workflows/*.yml|yaml or .gitlab-ci.yml exists.",
    "- has_ci_validation: a CI pipeline runs validation commands on push or pull request events.",
  ];
}

function appendWithinLimit(lines: string[], nextLines: string[], maxChars: number): void {
  if (maxChars <= 0) {
    return;
  }

  let currentLength = lines.length === 0 ? 0 : lines.join("\n").length;
  for (const line of nextLines) {
    const separator = lines.length === 0 ? 0 : 1;
    const available = maxChars - currentLength - separator;
    if (available <= 0) {
      return;
    }

    if (line.length <= available) {
      lines.push(line);
      currentLength += separator + line.length;
      continue;
    }

    if (available > 0) {
      lines.push(line.slice(0, available));
    }
    return;
  }
}

function buildPromptLines(
  projectPath: string,
  evidence: RepoEvidence,
  context?: DeepAuditContext,
  limits: DeepPromptLimits = {},
): string[] {
  const maxPromptChars = limits.maxPromptChars ?? MAX_DEEP_PROMPT_CHARS;
  const maxEvidenceChars = limits.maxEvidenceChars ?? DEFAULT_MAX_EVIDENCE_CHARS;
  const maxContextChars = limits.maxContextChars ?? DEFAULT_MAX_CONTEXT_CHARS;

  const lines: string[] = [];
  appendWithinLimit(
    lines,
    [
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
    ],
    maxPromptChars,
  );

  appendWithinLimit(lines, jsonBlockLines("Heuristic evidence", evidence, maxEvidenceChars), maxPromptChars);

  if (context?.sections.length) {
    appendWithinLimit(
      lines,
      ["", "Deep context excerpts (deterministic, bounded):"],
      maxPromptChars,
    );
    appendWithinLimit(lines, jsonBlockLines("Context excerpts", context.sections, maxContextChars), maxPromptChars);
  }

  appendWithinLimit(
    lines,
    [
      "",
      "Evaluate each check ID below. For each check return:",
      "- passed: boolean",
      "- evidence: one sentence with concrete repo-specific proof (or absence)",
      "- failureNote: optional short remediation-oriented note when passed=false",
      "",
      "Check IDs:",
      "",
      ...DEEP_CHECK_IDS,
      "",
      ...buildIntentGuideLines(),
      "",
      "Respond ONLY with JSON matching the provided schema.",
    ],
    maxPromptChars,
  );

  return lines;
}

export function buildDeepAuditPrompt(
  projectPath: string,
  evidence: RepoEvidence,
  context?: DeepAuditContext,
  limits?: DeepPromptLimits,
): string {
  return buildPromptLines(projectPath, evidence, context, limits).join("\n");
}

export function estimateDeepPromptTokens(
  projectPath: string,
  evidence: RepoEvidence,
  context?: DeepAuditContext,
  limits?: DeepPromptLimits,
): number {
  return estimateTokens(buildDeepAuditPrompt(projectPath, evidence, context, limits));
}
