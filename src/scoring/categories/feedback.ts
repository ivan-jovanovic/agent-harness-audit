import type { RepoEvidence, CategoryScore, CheckResult, DeepCheckOverrides } from "../../types.js";

const CATEGORY_WEIGHT = 0.25;

export function scoreFeedback(evidence: RepoEvidence, deepOverrides?: DeepCheckOverrides): CategoryScore {
  const hasTestScript = evidence.packages.scripts.hasTest || deepOverrides?.has_test_script === true;
  const hasTestDir = evidence.tests.hasTestDir || deepOverrides?.has_test_dir === true;
  const hasTestFiles = evidence.tests.hasTestFiles || deepOverrides?.has_test_files === true;

  const checks: CheckResult[] = [
    {
      id: "has_test_script",
      passed: hasTestScript,
      weight: 0.25,
      label: "test script present",
      failureNote: hasTestScript
        ? undefined
        : "No `test` script found in package.json — the agent has no standard command to run the test suite after making changes.",
    },
    {
      id: "has_test_dir",
      passed: hasTestDir,
      weight: 0.30,
      label: "test directory exists",
      failureNote: hasTestDir
        ? undefined
        : "No tests/, test/, or __tests__/ directory found — there is no test suite for the agent to run or extend when making changes.",
    },
    {
      id: "has_test_files",
      passed: hasTestFiles,
      weight: 0.15,
      label: "test files present",
      failureNote: hasTestFiles
        ? undefined
        : "No *.test.* or *.spec.* files found at the project root — there are no co-located test files for the agent to reference when adding or modifying features.",
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
