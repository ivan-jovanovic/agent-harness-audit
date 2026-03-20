import type { RepoEvidence, CategoryScore, CheckResult } from "../../types.js";

const CATEGORY_WEIGHT = 0.10;

export function scoreSafety(evidence: RepoEvidence): CategoryScore {
  const checks: CheckResult[] = [
    {
      id: "has_env_example",
      passed: evidence.files.hasEnvExample,
      weight: 0.40,
      label: ".env.example present",
      failureNote: evidence.files.hasEnvExample
        ? undefined
        : "No .env.example found — agents may create or modify code that references environment variables without knowing which are required or what format they take.",
    },
    {
      id: "has_contributing",
      passed: evidence.files.hasContributing,
      weight: 0.30,
      label: "CONTRIBUTING.md present",
      failureNote: evidence.files.hasContributing
        ? undefined
        : "No CONTRIBUTING.md found — agents have no documented contribution model to follow (branch strategy, commit conventions, review process).",
    },
    {
      id: "has_architecture_docs",
      passed: evidence.files.hasArchitectureDocs,
      weight: 0.30,
      label: "Architecture docs exist",
      failureNote: evidence.files.hasArchitectureDocs
        ? undefined
        : "No ARCHITECTURE.md or docs/architecture.* found — agents cannot build a stable mental model of the codebase structure from documentation.",
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
