import type { RepoEvidence, CategoryScore, CheckResult } from "../../types.js";

const CATEGORY_WEIGHT = 0.25;

export function scoreFeedback(evidence: RepoEvidence): CategoryScore {
  const checks: CheckResult[] = [
    {
      id: "has_test_script",
      passed: evidence.packages.scripts.hasTest,
      weight: 0.25,
      label: "test script present",
      failureNote: evidence.packages.scripts.hasTest
        ? undefined
        : "No `test` script found in package.json — the agent has no standard command to run the test suite after making changes.",
    },
    {
      id: "has_test_dir",
      passed: evidence.tests.hasTestDir,
      weight: 0.30,
      label: "test directory exists",
      failureNote: evidence.tests.hasTestDir
        ? undefined
        : "No tests/, test/, or __tests__/ directory found — there is no test suite for the agent to run or extend when making changes.",
    },
    {
      id: "has_test_files",
      passed: evidence.tests.hasTestFiles,
      weight: 0.15,
      label: "test files present",
      failureNote: evidence.tests.hasTestFiles
        ? undefined
        : "No *.test.* or *.spec.* files found at the project root — there are no co-located test files for the agent to reference when adding or modifying features.",
    },
    {
      id: "has_ci_workflows",
      passed: evidence.workflows.hasCIWorkflows,
      weight: 0.30,
      label: "CI workflows present",
      failureNote: evidence.workflows.hasCIWorkflows
        ? undefined
        : "No .github/workflows/*.yml files found — there is no automated validation step that runs on every push or pull request.",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passingWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 50) / 10 : 0;

  const failingChecks = checks.filter((c) => !c.passed);

  return {
    id: "feedback",
    label: "Feedback",
    score,
    maxScore: 5,
    checks,
    failingChecks,
  };
}

export { CATEGORY_WEIGHT as FEEDBACK_WEIGHT };
