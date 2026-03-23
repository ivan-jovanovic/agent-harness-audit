import type {
  RepoEvidence,
  AuditInput,
  ScoringResult,
  CategoryScore,
  Blocker,
  FixItem,
  CategoryId,
} from "../types.js";
import { scoreInstructions, INSTRUCTIONS_WEIGHT } from "./categories/instructions.js";
import { scoreContext, CONTEXT_WEIGHT } from "./categories/context.js";
import { scoreTooling, TOOLING_WEIGHT } from "./categories/tooling.js";
import { scoreFeedback, FEEDBACK_WEIGHT } from "./categories/feedback.js";
import { scoreSafety, SAFETY_WEIGHT } from "./categories/safety.js";

const CATEGORY_WEIGHTS: Record<CategoryId, number> = {
  instructions: INSTRUCTIONS_WEIGHT,
  context: CONTEXT_WEIGHT,
  tooling: TOOLING_WEIGHT,
  feedback: FEEDBACK_WEIGHT,
  safety: SAFETY_WEIGHT,
};

const EFFORT_TABLE: Record<string, "quick" | "medium" | "heavy"> = {
  has_agents_md: "quick",
  has_claude_md: "quick",
  has_readme: "medium",
  has_contributing: "medium",
  has_architecture_docs: "heavy",
  has_docs_dir: "medium",
  has_tsconfig: "quick",
  has_env_example: "quick",
  has_package_json: "quick",
  has_lockfile: "quick",
  has_lint_script: "medium",
  has_typecheck_script: "quick",
  has_build_script: "quick",
  has_test_script: "medium",
  has_test_dir: "medium",
  has_test_files: "medium",
  has_ci_workflows: "medium",
};

const ACTION_TABLE: Record<string, string> = {
  has_agents_md:
    "Create AGENTS.md at your project root with operating rules, common tasks, and validation commands.",
  has_claude_md:
    "Create CLAUDE.md at your project root. Claude Code reads this file automatically at the start of every session.",
  has_readme:
    "Add README.md to the project root with a description, setup steps, and basic usage.",
  has_contributing:
    "Add CONTRIBUTING.md describing your branch strategy, commit format, and how changes get reviewed.",
  has_architecture_docs:
    "Add ARCHITECTURE.md or docs/architecture.md describing key directories, data flow, and major design decisions.",
  has_docs_dir:
    "Create a docs/ directory and move or start any project documentation there.",
  has_tsconfig:
    "Add tsconfig.json to the project root. Run `npx tsc --init` for a sensible default, then adjust for your build target.",
  has_env_example:
    "Add .env.example listing all required environment variable names. Values can be blank or use placeholder text like `your_key_here`.",
  has_package_json:
    "Run `npm init` (or `pnpm init`) to create package.json at the project root.",
  has_lockfile:
    "Run `npm install` (or your package manager's install command) to generate a lockfile and commit it.",
  has_lint_script:
    'Add a `"lint"` script to package.json. Example: `"lint": "eslint src --ext .ts,.tsx"`.',
  has_typecheck_script:
    'Add `"typecheck": "tsc --noEmit"` to your package.json scripts.',
  has_build_script:
    'Add a `"build"` script to package.json that compiles or bundles your project (e.g., `"build": "tsc"` or `"build": "next build"`).',
  has_test_script:
    'Add a `"test"` script to package.json pointing to your test runner (e.g., `"test": "vitest run"` or `"test": "jest"`).',
  has_test_dir:
    "Create a tests/ directory and add at least one test file. Even a single passing test gives the agent a feedback loop.",
  has_test_files:
    "Add test files alongside your source files (e.g., `src/utils.test.ts`) or inside a dedicated test directory.",
  has_ci_workflows:
    "Add a GitHub Actions workflow file at .github/workflows/ci.yml that runs lint, typecheck, and tests on push.",
};

const BLOCKER_TITLE_TABLE: Record<string, string> = {
  has_agents_md: "No agent operating rules",
  has_claude_md: "No Claude Code project config",
  has_readme: "No project README",
  has_contributing: "No contribution guidelines",
  has_architecture_docs: "No architecture documentation",
  has_docs_dir: "No docs directory",
  has_tsconfig: "No TypeScript config",
  has_env_example: "No environment variable documentation",
  has_package_json: "No package.json",
  has_lockfile: "No lockfile",
  has_lint_script: "No lint script",
  has_typecheck_script: "No typecheck script",
  has_build_script: "No build script",
  has_test_script: "No test script",
  has_test_dir: "No test directory",
  has_test_files: "No test files",
  has_ci_workflows: "No CI workflows",
};

export function scoreProject(
  evidence: RepoEvidence,
  input: Pick<AuditInput, "tool">
): ScoringResult {
  const categoryScores: CategoryScore[] = [
    scoreInstructions(evidence, input),
    scoreContext(evidence),
    scoreTooling(evidence),
    scoreFeedback(evidence),
    scoreSafety(evidence),
  ];

  // Overall score: sum(categoryScore / 5 * categoryWeight) * 100, integer
  const rawOverall = categoryScores.reduce((sum, cat) => {
    return sum + (cat.score / 5) * CATEGORY_WEIGHTS[cat.id];
  }, 0);
  const overallScore = Math.round(rawOverall * 100);

  // Collect all failing checks with their impact = categoryWeight * checkWeight
  interface FailingEntry {
    categoryId: CategoryId;
    checkId: string;
    weight: number;
    failureNote: string;
    impact: number;
  }

  const allFailing: FailingEntry[] = [];
  for (const cat of categoryScores) {
    const catWeight = CATEGORY_WEIGHTS[cat.id];
    for (const check of cat.failingChecks) {
      allFailing.push({
        categoryId: cat.id,
        checkId: check.id,
        weight: check.weight,
        failureNote: check.failureNote ?? "",
        impact: catWeight * check.weight,
      });
    }
  }

  // Sort by impact descending
  allFailing.sort((a, b) => b.impact - a.impact);

  // Deduplicate by checkId — keep first occurrence (highest impact after sort)
  const seen = new Set<string>();
  const dedupedFailing = allFailing.filter((entry) => {
    if (seen.has(entry.checkId)) return false;
    seen.add(entry.checkId);
    return true;
  });

  // Top 3 blockers
  const topBlockers: Blocker[] = dedupedFailing.slice(0, 3).map((entry) => ({
    categoryId: entry.categoryId,
    checkId: entry.checkId,
    title: BLOCKER_TITLE_TABLE[entry.checkId] ?? entry.checkId,
    why: entry.failureNote,
    likelyFailureMode: entry.failureNote,
    effort: EFFORT_TABLE[entry.checkId] ?? "medium",
  }));

  // Fix plan: all failing checks in impact order (deduplicated)
  const fixPlan: FixItem[] = dedupedFailing.map((entry, index) => ({
    categoryId: entry.categoryId,
    checkId: entry.checkId,
    action: ACTION_TABLE[entry.checkId] ?? `Fix ${entry.checkId}`,
    effort: EFFORT_TABLE[entry.checkId] ?? "medium",
    priority: index + 1,
  }));

  return {
    overallScore,
    categoryScores,
    topBlockers,
    fixPlan,
  };
}
