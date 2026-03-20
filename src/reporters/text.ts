import type { AuditReport, CategoryScore, Blocker, FixItem } from "../types.js";

// ── ANSI helpers ──────────────────────────────────────────────────────────────

const isTTY = process.stdout.isTTY === true;

const RESET = isTTY ? "\x1b[0m" : "";
const BOLD = isTTY ? "\x1b[1m" : "";
const RED = isTTY ? "\x1b[31m" : "";
const YELLOW = isTTY ? "\x1b[33m" : "";
const GREEN = isTTY ? "\x1b[32m" : "";
const CYAN = isTTY ? "\x1b[36m" : "";

function red(s: string): string {
  return `${RED}${s}${RESET}`;
}
function yellow(s: string): string {
  return `${YELLOW}${s}${RESET}`;
}
function green(s: string): string {
  return `${GREEN}${s}${RESET}`;
}
function cyan(s: string): string {
  return `${CYAN}${s}${RESET}`;
}
function bold(s: string): string {
  return `${BOLD}${s}${RESET}`;
}

// ── Layout constants ──────────────────────────────────────────────────────────

const RULE_WIDTH = 53;
const RULE = "─".repeat(RULE_WIDTH);

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
  has_agents_md: "AGENTS.md",
  has_claude_md: "CLAUDE.md",
  has_readme: "README",
  has_contributing: "CONTRIBUTING.md",
  has_architecture_docs: "architecture docs",
  has_docs_dir: "docs/",
  has_tsconfig: "tsconfig.json",
  has_env_example: ".env.example",
  has_package_json: "package.json",
  has_lockfile: "lockfile",
  has_lint_script: "lint",
  has_typecheck_script: "typecheck",
  has_build_script: "build",
  has_test_script: "test script",
  has_test_dir: "test dir",
  has_test_files: "test files",
  has_ci_workflows: "CI workflows",
};

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

// ── Main reporter ─────────────────────────────────────────────────────────────

export function reportText(report: AuditReport): void {
  const { scoring } = report;
  const { overallScore, categoryScores, topBlockers, fixPlan } = scoring;
  const out = (s: string) => process.stdout.write(s + "\n");

  // ── Zone 1: Score banner ──────────────────────────────────────────────────
  out(rule());
  out(
    `  ${bold("Agent Harness Score:")} ${bold(String(overallScore))} / 100  ${overallBar(overallScore)}  ${scoreLabel(overallScore)}`
  );
  out(rule());
  out("");

  // ── Zone 2: Category table ────────────────────────────────────────────────
  const CAT_LABEL_WIDTH = 14;
  for (const cat of categoryScores) {
    const label = cat.label.padEnd(CAT_LABEL_WIDTH);
    const bar = categoryBar(cat.score);
    const scoreStr = `${Number.isInteger(cat.score) ? cat.score : cat.score.toFixed(1)} / 5`;
    const summary = categoryFindingSummary(cat);
    out(`  ${label}  ${bar}  ${scoreStr}   ${summary}`);
  }
  out("");

  // Happy path: no blockers
  if (topBlockers.length === 0) {
    out(rule());
    out("  This project is well-configured for AI coding agent use.");
    out("  No critical blockers found.");
    out(rule());
    out("");
    return;
  }

  // ── Zone 3: Top blockers ──────────────────────────────────────────────────
  out(rule());
  out(`  ${bold("Top Blockers")}`);
  out(rule());
  out("");
  renderBlockers(topBlockers, out);

  // ── Zone 4: Fix plan ──────────────────────────────────────────────────────
  out(rule());
  out(`  ${bold("Fix Plan")}`);
  out(rule());
  out("");
  renderFixPlan(fixPlan, out);

  // ── Zone 5: Next step hint ────────────────────────────────────────────────
  if (overallScore < 80) {
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
  out: (s: string) => void
): void {
  for (let i = 0; i < blockers.length; i++) {
    const b = blockers[i];
    out(`  ${i + 1}. ${bold(b.title)}`);
    if (b.why) {
      out(`     ${b.why}`);
    }
    if (b.likelyFailureMode && b.likelyFailureMode !== b.why) {
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
  has_agents_md: "Add AGENTS.md with project-specific rules for your coding agent.",
  has_claude_md: "Create CLAUDE.md at your project root.",
  has_readme: "Add README.md with a description, setup steps, and basic usage.",
  has_contributing: "Add CONTRIBUTING.md describing your branch strategy and review process.",
  has_architecture_docs: "Add ARCHITECTURE.md describing key directories and design decisions.",
  has_docs_dir: "Create a docs/ directory and start documentation there.",
  has_tsconfig: "Add tsconfig.json to the project root.",
  has_env_example: "Add .env.example listing all required environment variable names.",
  has_package_json: "Run `npm init` to create package.json.",
  has_lockfile: "Run `npm install` to generate a lockfile and commit it.",
  has_lint_script: 'Add a "lint" script to package.json.',
  has_typecheck_script: 'Add "typecheck": "tsc --noEmit" to your package.json scripts.',
  has_build_script: 'Add a "build" script to package.json.',
  has_test_script: 'Add a "test" script to package.json.',
  has_test_dir: "Create a tests/ directory with at least one test file.",
  has_test_files: "Add test files (e.g. src/utils.test.ts) alongside your source.",
  has_ci_workflows: "Add a GitHub Actions workflow at .github/workflows/ci.yml.",
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
