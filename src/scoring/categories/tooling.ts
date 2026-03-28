import type { RepoEvidence, CategoryScore, CheckResult, DeepCheckOverrides } from "../../types.js";

const CATEGORY_WEIGHT = 0.25;

export function scoreTooling(evidence: RepoEvidence, deepOverrides?: DeepCheckOverrides): CategoryScore {
  const hasPackageJson = evidence.packages.hasPackageJson || deepOverrides?.has_package_json === true;
  const hasLockfile = evidence.packages.hasLockfile || deepOverrides?.has_lockfile === true;
  const hasLintScript = evidence.packages.scripts.hasLint || deepOverrides?.has_lint_script === true;
  const hasTypecheckScript =
    evidence.packages.scripts.hasTypecheck || deepOverrides?.has_typecheck_script === true;
  const hasBuildScript = evidence.packages.scripts.hasBuild || deepOverrides?.has_build_script === true;

  const checks: CheckResult[] = [
    {
      id: "has_package_json",
      passed: hasPackageJson,
      weight: 0.20,
      label: "package.json present",
      failureNote: hasPackageJson
        ? undefined
        : "No package.json found — the agent cannot determine project dependencies, scripts, or runtime configuration.",
    },
    {
      id: "has_lockfile",
      passed: hasLockfile,
      weight: 0.20,
      label: "Lockfile present",
      failureNote: hasLockfile
        ? undefined
        : "No lockfile found (expected package-lock.json, pnpm-lock.yaml, or yarn.lock) — dependency versions are not pinned and installations may not be reproducible.",
    },
    {
      id: "has_lint_script",
      passed: hasLintScript,
      weight: 0.20,
      label: "lint script present",
      failureNote: hasLintScript
        ? undefined
        : "No `lint` script found in package.json — the agent has no standard command to check code style and catch common errors after making changes.",
    },
    {
      id: "has_typecheck_script",
      passed: hasTypecheckScript,
      weight: 0.20,
      label: "typecheck script present",
      failureNote: hasTypecheckScript
        ? undefined
        : "No `typecheck` script found in package.json — the agent cannot run a type-only check without triggering a full build.",
    },
    {
      id: "has_build_script",
      passed: hasBuildScript,
      weight: 0.20,
      label: "build script present",
      failureNote: hasBuildScript
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
