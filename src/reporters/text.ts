import type { AuditReport, CategoryScore, Blocker, FixItem, ToolReadiness, ToolSpecificFixItem } from "../types.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY === true;
let colorEnabled = isTTY;

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const RED = "\x1b[31m";
const YELLOW = "\x1b[33m";
const GREEN = "\x1b[32m";
const CYAN = "\x1b[36m";

function withColor(code: string, s: string): string {
  if (!colorEnabled) {
    return s;
  }
  return `${code}${s}${RESET}`;
}

function red(s: string): string {
  return withColor(RED, s);
}
function yellow(s: string): string {
  return withColor(YELLOW, s);
}
function green(s: string): string {
  return withColor(GREEN, s);
}
function cyan(s: string): string {
  return withColor(CYAN, s);
}
function bold(s: string): string {
  return withColor(BOLD, s);
}

// ── Layout constants ──────────────────────────────────────────────────────────

const RULE_WIDTH = 53;
const RULE = "─".repeat(RULE_WIDTH);
// Category line prefix: 2 + CAT_LABEL_WIDTH(14) + 2 + bar(5) + 2 + scoreStr(7) + 3 = 35
const SUMMARY_MAX_WIDTH = 80 - 35;

function rule(): string {
  return RULE;
}

// ── Score bar ─────────────────────────────────────────────────────────────────

/** Returns a 10-character dot bar for the overall score (0–100). */
function overallBar(score: number): string {
  const filled = Math.round(score / 10);
  const bar = "●".repeat(filled) + "○".repeat(10 - filled);
  return colorByOverallScore(score, bar);
}

/** Returns a 5-character block bar for a category score (0–5). */
function categoryBar(score: number): string {
  const filled = Math.round(score);
  const bar = "█".repeat(filled) + "░".repeat(5 - filled);
  return colorByCategoryScore(score, bar);
}

function colorByOverallScore(score: number, text: string): string {
  if (score >= 80) return green(text);
  if (score >= 50) return yellow(text);
  if (score >= 25) return yellow(text);
  return red(text);
}

function colorByCategoryScore(score: number, text: string): string {
  if (score >= 5) return green(text);
  if (score >= 2.5) return yellow(text);
  return red(text);
}

function scoreLabel(score: number): string {
  if (score >= 80) return green("READY");
  if (score >= 50) return yellow("GOOD");
  if (score >= 25) return yellow("NEEDS WORK");
  return red("NOT READY");
}

// ── Category summary line ─────────────────────────────────────────────────────

const CHECK_SHORT_LABEL: Record<string, string> = {
  has_primary_instructions: "primary instructions",
  has_generic_skills: "generic skills",
  has_tool_skills: "tool skills",
  has_readme: "README",
  has_architecture_docs: "architecture docs",
  has_docs_index: "docs index",
  has_structured_docs: "structured docs",
  has_docs_dir: "docs/",
  has_tsconfig: "tsconfig.json",
  has_env_example: ".env.example",
  has_package_json: "package.json",
  has_lockfile: "lockfile",
  has_architecture_lints: "arch lint",
  has_local_dev_boot_path: "local boot",
  has_lint_script: "lint",
  has_typecheck_script: "typecheck",
  has_build_script: "build",
  has_test_script: "test script",
  has_test_dir: "test dir",
  has_test_files: "test files",
  has_e2e_or_smoke_tests: "e2e or smoke tests",
  has_ci_pipeline: "CI pipeline",
  has_ci_validation: "CI validation",
};

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function shortLabel(checkId: string, fallbackLabel: string): string {
  return CHECK_SHORT_LABEL[checkId] ?? fallbackLabel.replace(/ (present|exists?)\s*$/i, "");
}

function categoryFindingSummary(cat: CategoryScore): string {
  if (cat.failingChecks.length === 0) {
    if (cat.id === "tooling") {
      return "package.json ✓  lockfile ✓  scripts ✓";
    }
    // Build evidence-grounded passing summary from top passing checks
    const top = cat.checks
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map((c) => `${shortLabel(c.id, c.label)} ✓`);
    return top.join("  ");
  }
  const missing = cat.failingChecks
    .slice(0, 2)
    .map((c) => shortLabel(c.id, c.label))
    .join(", ");
  return `Missing: ${missing}`;
}

// ── Effort group label ────────────────────────────────────────────────────────

function effortLabel(effort: string): string {
  switch (effort) {
    case "quick":
      return "QUICK (< 30 min)";
    case "medium":
      return "MEDIUM (1–2 hrs)";
    case "heavy":
      return "HEAVY (half day+)";
    default:
      return effort.toUpperCase();
  }
}

function formatToolName(tool: string): string {
  switch (tool) {
    case "claude-code":
      return "Claude Code";
    case "codex":
      return "Codex";
    case "cursor":
      return "Cursor";
    case "copilot":
      return "Copilot";
    default:
      return "Other";
  }
}

function renderToolReadiness(toolReadiness: ToolReadiness[], out: (s: string) => void): void {
  out(rule());
  out(`  ${bold("Tool-Specific Readiness")}`);
  out(rule());
  out("");

  const actionable = toolReadiness.filter((item) => item.status === "needs-work");
  const notScored = toolReadiness.filter((item) => item.status === "not-scored");

  if (actionable.length === 0) {
    out("  No tool-specific issues detected");
  } else {
    for (const item of actionable) {
      const score = `${item.score ?? 0} / ${item.maxScore ?? 5}`;
      const missing = item.checks
        ?.filter((check) => !check.passed)
        .map((check) => shortLabel(check.id, check.label))
        .join(", ");
      out(`  ${formatToolName(item.tool).padEnd(14)}  ${score.padEnd(5)}   Missing: ${missing}`);
    }
  }

  if (notScored.length > 0) {
    const labels = notScored.map((item) => formatToolName(item.tool)).join(", ");
    out(`  Other targets: ${labels}  (${notScored[0].note})`);
  }

  out("");
}

function renderAuditRationale(out: (s: string) => void): void {
  out("  This audit scores what agents need to work safely in-repo:");
  out("  clear instructions, discoverable context, runnable validation,");
  out("  and environment/setup guidance.");
  out("");
  out("  Missing items matter when they remove the agent's ability to");
  out("  understand the repo, scope changes, or verify results.");
  out("");
}

// ── Main reporter ─────────────────────────────────────────────────────────────

export function reportText(report: AuditReport): void {
  colorEnabled = isTTY && !report.input.noColor;

  const { scoring, evidence } = report;
  const { overallScore, categoryScores, topBlockers, fixPlan, toolReadiness, toolSpecificFixes } = scoring;
  const out = (s: string) => process.stdout.write(s + "\n");

  // ── Warnings (if any) ─────────────────────────────────────────────────────
  if (evidence.warnings.length > 0) {
    for (const w of evidence.warnings) {
      out(`  ⚠  ${w}`);
    }
    out("");
  }

  if (report.input.deep && report.deepAudit) {
    const deep = report.deepAudit;
    const usageLabel = report.input.tokens
      ? `tokens: ${deep.tokensActual > 0 ? deep.tokensActual : `~${deep.tokenEstimate}`}`
      : `cost: $${(deep.costActualUsd > 0 ? deep.costActualUsd : deep.costEstimateUsd).toFixed(4)}`;
    out(`  ${yellow("⚠")}  Deep audit — results may vary between runs. Agent: ${deep.agentName}. ${usageLabel}.`);
    out("");
  }

  // ── Zone 1: Score banner ──────────────────────────────────────────────────
  out(rule());
  out(
    `  ${bold("Agent Harness Score:")} ${bold(String(overallScore))} / 100  ${overallBar(overallScore)}  ${scoreLabel(overallScore)}`
  );
  out(rule());
  out("");

  renderAuditRationale(out);

  // ── Zone 2: Category table ────────────────────────────────────────────────
  const CAT_LABEL_WIDTH = 14;
  for (const cat of categoryScores) {
    const label = cat.label.padEnd(CAT_LABEL_WIDTH);
    const bar = categoryBar(cat.score);
    const scoreStr = `${Number.isInteger(cat.score) ? cat.score : cat.score.toFixed(1)} / 5`;
    const summary = truncate(categoryFindingSummary(cat), SUMMARY_MAX_WIDTH);
    out(`  ${label}  ${bar}  ${scoreStr}   ${summary}`);
  }
  out("");

  renderToolReadiness(toolReadiness, out);

  // Happy path: no blockers or tool-specific fixes
  if (topBlockers.length === 0 && toolSpecificFixes.length === 0) {
    out(rule());
    out("  This project is well-configured for AI coding agent use.");
    out("  No critical blockers found.");
    out(rule());
    out("");
    return;
  }

  if (topBlockers.length > 0) {
    // ── Zone 3: Top blockers ────────────────────────────────────────────────
    out(rule());
    out(`  ${bold("Top Blockers")}`);
    out(rule());
    out("");
    const deepEvidenceByCheck = Object.fromEntries(
      (report.deepAudit?.findings ?? []).map((finding) => [finding.checkId, finding.evidence]),
    );
    renderBlockers(topBlockers, out, deepEvidenceByCheck);

    // ── Zone 4: Fix plan ────────────────────────────────────────────────────
    out(rule());
    out(`  ${bold("Fix Plan")}`);
    out(rule());
    out("");
    renderFixPlan(fixPlan, out);
  } else {
    out(rule());
    out("  No core blockers found.");
    out(rule());
    out("");
  }

  if (toolSpecificFixes.length > 0) {
    out(rule());
    out(`  ${bold("Tool-Specific Fixes")}`);
    out(rule());
    out("");
    renderToolSpecificFixes(toolSpecificFixes, out);
  }

  // ── Zone 5: Next step hint ────────────────────────────────────────────────
  if (overallScore < 80 || toolSpecificFixes.length > 0) {
    out(rule());
    out("");
    out(
      `  Run ${cyan("agent-harness audit . --write-artifacts")} to generate starter files.`
    );
  }

  out("");
}

function renderBlockers(
  blockers: Blocker[],
  out: (s: string) => void,
  deepEvidenceByCheckId: Record<string, string> = {},
): void {
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    const evidence = deepEvidenceByCheckId[b.checkId];
    const why = evidence && evidence.length > 0 ? evidence : b.why;
    out(`  ${i + 1}. ${bold(b.title)}`);
    if (why) {
      out(`     ${why}`);
    }
    if (b.likelyFailureMode && b.likelyFailureMode !== why) {
      out(`     ${b.likelyFailureMode}`);
    }
    const action = BLOCKER_ACTION_TABLE[b.checkId];
    if (action) {
      out(`     ${cyan("→")} ${action}`);
    }
    out("");
  }
}

const BLOCKER_ACTION_TABLE: Record<string, string> = {
  has_primary_instructions:
    "Add AGENTS.md for general use, or CLAUDE.md if this repo is intentionally Claude-only.",
  has_generic_skills: "Add at least one reusable generic project skill under .agents/skills/.../SKILL.md.",
  has_tool_skills:
    "Add tool-specific skills for every selected supported tool under .claude/skills/.../SKILL.md and/or .cursor/skills/.../SKILL.md.",
  has_readme: "Add README.md with a description, setup steps, and basic usage.",
  has_architecture_docs:
    "Add a discoverable architecture guide at the repo root or in docs/ (for example ARCHITECTURE.md, SYSTEM.md, or docs/repo-structure.md).",
  has_docs_index:
    "Add a docs index such as docs/index.md or docs/README.md so agents have a clear entrypoint into the repository documentation.",
  has_structured_docs:
    "Organize docs/ into topical sections or add multiple docs files so the repository documentation is structured and easier to navigate.",
  has_docs_dir: "Create a docs/ directory and start documentation there.",
  has_tsconfig: "Add tsconfig.json to the project root.",
  has_env_example: "Add .env.example listing all required environment variable names.",
  has_package_json: "Run `npm init` to create package.json.",
  has_lockfile: "Run `npm install` to generate a lockfile and commit it.",
  has_architecture_lints:
    "Add boundary-enforcement tooling such as dependency-cruiser or eslint-plugin-boundaries so architecture rules are checked mechanically.",
  has_local_dev_boot_path:
    "Add a local boot script such as `dev`, `start`, `preview`, or `serve` so the agent can run the app during iterative work.",
  has_lint_script: 'Add a "lint" script to package.json.',
  has_typecheck_script: 'Add "typecheck": "tsc --noEmit" to your package.json scripts.',
  has_build_script: 'Add a "build" script to package.json.',
  has_test_script: 'Add a "test" script to package.json.',
  has_test_dir: "Create a tests/ directory with at least one test file.",
  has_test_files: "Add test files (e.g. src/utils.test.ts) alongside your source.",
  has_e2e_or_smoke_tests:
    "Add an e2e or smoke-test signal such as Playwright/Cypress config, an e2e/ or smoke/ directory, or a dedicated smoke-test script.",
  has_ci_pipeline:
    "Add a CI pipeline file such as `.github/workflows/*.yml|yaml` or `.gitlab-ci.yml` so changes are validated in automation.",
  has_ci_validation:
    "Add validation commands such as lint, typecheck, build, or test to the existing CI pipeline.",
};

function renderFixPlan(fixPlan: FixItem[], out: (s: string) => void): void {
  const grouped: Record<string, FixItem[]> = { quick: [], medium: [], heavy: [] };
  for (const item of fixPlan) {
    (grouped[item.effort] ?? grouped["medium"]).push(item);
  }

  const effortOrder: Array<"quick" | "medium" | "heavy"> = ["quick", "medium", "heavy"];
  for (const effort of effortOrder) {
    const items = grouped[effort];
    if (!items || items.length === 0) continue;
    out(`  ${bold(effortLabel(effort))}`);
    for (const item of items) {
      out(`  ☐ ${item.action}`);
    }
    out("");
  }
}

function renderToolSpecificFixes(
  fixPlan: ToolSpecificFixItem[],
  out: (s: string) => void
): void {
  for (const item of fixPlan) {
    out(`  ☐ [${formatToolName(item.tool)}] ${item.action}`);
  }
  out("");
}
