import type { RepoEvidence, CategoryScore, CheckResult, DeepCheckOverrides } from "../../types.js";

const CATEGORY_WEIGHT = 0.10;

export function scoreSafety(evidence: RepoEvidence, deepOverrides?: DeepCheckOverrides): CategoryScore {
  const hasEnvExample = evidence.files.hasEnvExample || deepOverrides?.has_env_example === true;
  const hasArchitectureDocs =
    evidence.files.hasArchitectureDocs || deepOverrides?.has_architecture_docs === true;

  const checks: CheckResult[] = [
    {
      id: "has_env_example",
      passed: hasEnvExample,
      weight: 0.60,
      label: ".env.example present",
      failureNote: hasEnvExample
        ? undefined
        : "No .env.example found — agents may create or modify code that references environment variables without knowing which are required or what format they take.",
    },
    {
      id: "has_architecture_docs",
      passed: hasArchitectureDocs,
      weight: 0.40,
      label: "Architecture docs exist",
      failureNote: hasArchitectureDocs
        ? undefined
        : "No discoverable architecture guide found at the repo root or in docs/ — agents cannot build a stable mental model of the codebase structure from documentation.",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passingWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 50) / 10 : 0;

  const failingChecks = checks.filter((c) => !c.passed);

  return {
    id: "safety",
    label: "Safety",
    score,
    maxScore: 5,
    checks,
    failingChecks,
  };
}

export { CATEGORY_WEIGHT as SAFETY_WEIGHT };
