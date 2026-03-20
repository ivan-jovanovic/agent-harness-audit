import type { RepoEvidence, CategoryScore, CheckResult } from "../../types.js";

const CATEGORY_WEIGHT = 0.20;

export function scoreTooling(evidence: RepoEvidence): CategoryScore {
  const checks: CheckResult[] = [
    {
      id: "has_package_json",
      passed: evidence.packages.hasPackageJson,
      weight: 0.20,
      label: "package.json present",
      failureNote: evidence.packages.hasPackageJson
        ? undefined
        : "No package.json found — the agent cannot determine project dependencies, scripts, or runtime configuration.",
    },
    {
      id: "has_lockfile",
      passed: evidence.packages.hasLockfile,
      weight: 0.20,
      label: "Lockfile present",
      failureNote: evidence.packages.hasLockfile
        ? undefined
        : "No lockfile found (expected package-lock.json, pnpm-lock.yaml, or yarn.lock) — dependency versions are not pinned and installations may not be reproducible.",
    },
    {
      id: "has_lint_script",
      passed: evidence.packages.scripts.hasLint,
      weight: 0.20,
      label: "lint script present",
      failureNote: evidence.packages.scripts.hasLint
        ? undefined
        : "No `lint` script found in package.json — the agent has no standard command to check code style and catch common errors after making changes.",
    },
    {
      id: "has_typecheck_script",
      passed: evidence.packages.scripts.hasTypecheck,
      weight: 0.20,
      label: "typecheck script present",
      failureNote: evidence.packages.scripts.hasTypecheck
        ? undefined
        : "No `typecheck` script found in package.json — the agent cannot run a type-only check without triggering a full build.",
    },
    {
      id: "has_build_script",
      passed: evidence.packages.scripts.hasBuild,
      weight: 0.20,
      label: "build script present",
      failureNote: evidence.packages.scripts.hasBuild
        ? undefined
        : "No `build` script found in package.json — the agent has no standard command to verify the project compiles successfully.",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passingWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 50) / 10 : 0;

  const failingChecks = checks.filter((c) => !c.passed);

  return {
    id: "tooling",
    label: "Tooling",
    score,
    maxScore: 5,
    checks,
    failingChecks,
  };
}

export { CATEGORY_WEIGHT as TOOLING_WEIGHT };
