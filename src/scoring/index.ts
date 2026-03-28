import type {
  RepoEvidence,
  AuditInput,
  ScoringResult,
  CategoryScore,
  Blocker,
  FixItem,
  CategoryId,
  ToolReadiness,
  ToolSpecificFixItem,
  TargetTool,
  CheckResult,
  DeepCheckOverrides,
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
  has_primary_instructions: "quick",
  has_generic_skills: "medium",
  has_tool_skills: "medium",
  has_claude_md: "quick",
  has_readme: "medium",
  has_architecture_docs: "heavy",
  has_docs_index: "medium",
  has_docs_dir: "medium",
  has_tsconfig: "quick",
  has_env_example: "quick",
  has_package_json: "quick",
  has_lockfile: "quick",
  has_architecture_lints: "medium",
  has_local_dev_boot_path: "medium",
  has_lint_script: "medium",
  has_typecheck_script: "quick",
  has_build_script: "quick",
  has_test_script: "medium",
  has_test_dir: "medium",
  has_test_files: "medium",
  has_ci_pipeline: "medium",
  has_e2e_or_smoke_tests: "medium",
  has_structured_docs: "medium",
  has_ci_validation: "medium",
};

const ACTION_TABLE: Record<string, string> = {
  has_primary_instructions:
    "Add a primary instruction surface: prefer AGENTS.md, or use CLAUDE.md if this repo is intentionally Claude-only.",
  has_generic_skills:
    "Add at least one reusable generic project skill under .agents/skills/.../SKILL.md.",
  has_tool_skills:
    "Add tool-specific skills for every selected supported tool under .claude/skills/.../SKILL.md and/or .cursor/skills/.../SKILL.md.",
  has_readme:
    "Add README.md to the project root with a description, setup steps, and basic usage.",
  has_architecture_docs:
    "Add a discoverable architecture guide at the repo root or in docs/ (for example ARCHITECTURE.md, SYSTEM.md, or docs/repo-structure.md) describing key directories, data flow, and major design decisions.",
  has_docs_index:
    "Add a docs index such as docs/index.md or docs/README.md so agents have a clear entrypoint into the repository documentation.",
  has_structured_docs:
    "Organize docs/ into topical sections or add multiple docs files so the repository documentation is discoverable and structured.",
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
  has_architecture_lints:
    "Add boundary-enforcement tooling such as dependency-cruiser or eslint-plugin-boundaries so architecture rules are checked mechanically.",
  has_local_dev_boot_path:
    "Add a local boot script such as `dev`, `start`, `preview`, or `serve` so the agent can run the app during iterative work.",
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
  has_e2e_or_smoke_tests:
    "Add an e2e or smoke-test signal such as Playwright/Cypress config, an `e2e/` or `smoke/` test directory, or a dedicated smoke-test script.",
  has_ci_pipeline:
    "Add a CI pipeline file such as `.github/workflows/*.yml|yaml` or `.gitlab-ci.yml` so changes are validated in automation.",
  has_ci_validation:
    "Add validation commands such as lint, typecheck, build, or test to the existing CI pipeline.",
};

const BLOCKER_TITLE_TABLE: Record<string, string> = {
  has_primary_instructions: "No primary instruction surface",
  has_generic_skills: "No generic project skills",
  has_tool_skills: "Missing selected tool skills",
  has_readme: "No project README",
  has_architecture_docs: "No architecture documentation",
  has_docs_index: "No docs index",
  has_structured_docs: "No structured docs",
  has_docs_dir: "No docs directory",
  has_tsconfig: "No TypeScript config",
  has_env_example: "No environment variable documentation",
  has_package_json: "No package.json",
  has_lockfile: "No lockfile",
  has_architecture_lints: "No architecture lints",
  has_local_dev_boot_path: "No local dev boot path",
  has_lint_script: "No lint script",
  has_typecheck_script: "No typecheck script",
  has_build_script: "No build script",
  has_test_script: "No test script",
  has_test_dir: "No test directory",
  has_test_files: "No test files",
  has_e2e_or_smoke_tests: "No e2e or smoke tests",
  has_ci_pipeline: "No CI pipeline",
  has_ci_validation: "No CI validation",
};

const TOOL_SPECIFIC_NOTE = "No tool-specific repo-level checks in v2";

function scoreClaudeReadiness(evidence: RepoEvidence): ToolReadiness {
  const checks: CheckResult[] = [
    {
      id: "has_claude_md",
      passed: evidence.files.hasCLAUDEMd,
      weight: 1.0,
      label: "CLAUDE.md present",
      failureNote: evidence.files.hasCLAUDEMd
        ? undefined
        : "No CLAUDE.md found — Claude Code will not load any project-level configuration at startup.",
    },
  ];

  return {
    tool: "claude-code",
    status: checks.every((check) => check.passed) ? "ready" : "needs-work",
    score: checks.every((check) => check.passed) ? 5 : 0,
    maxScore: 5,
    checks,
  };
}

function scoreToolReadiness(evidence: RepoEvidence, toolsResolved: TargetTool[]): ToolReadiness[] {
  return toolsResolved.map((tool) => {
    if (tool === "claude-code") {
      return scoreClaudeReadiness(evidence);
    }

    return {
      tool,
      status: "not-scored",
      note: TOOL_SPECIFIC_NOTE,
    };
  });
}

function buildToolSpecificFixes(toolReadiness: ToolReadiness[]): ToolSpecificFixItem[] {
  const failingEntries = toolReadiness.flatMap((readiness) => {
    if (!readiness.checks) return [];

    return readiness.checks
      .filter((check) => !check.passed)
      .map((check) => ({
        tool: readiness.tool,
        checkId: check.id,
      }));
  });

  return failingEntries.map((entry, index) => ({
    tool: entry.tool,
    checkId: entry.checkId,
    action:
      entry.checkId === "has_claude_md"
        ? "Create CLAUDE.md at your project root. Claude Code reads this file automatically at the start of every session."
        : `Fix ${entry.checkId}`,
    effort: EFFORT_TABLE[entry.checkId] ?? "medium",
    priority: index + 1,
  }));
}

export function scoreProject(
  evidence: RepoEvidence,
  input: Pick<AuditInput, "toolsRequested" | "toolsResolved">,
  deepOverrides: DeepCheckOverrides = {},
): ScoringResult {
  const categoryScores: CategoryScore[] = [
    scoreInstructions(evidence, { ...input, deepOverrides }),
    scoreContext(evidence, deepOverrides),
    scoreTooling(evidence, deepOverrides),
    scoreFeedback(evidence, deepOverrides),
    scoreSafety(evidence, deepOverrides),
  ];
  const toolReadiness = scoreToolReadiness(evidence, input.toolsResolved);
  const toolSpecificFixes = buildToolSpecificFixes(toolReadiness);

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
    toolReadiness,
    toolSpecificFixes,
  };
}
