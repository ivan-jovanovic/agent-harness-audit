import type { RepoEvidence, CategoryScore, CheckResult } from "../../types.js";

const CATEGORY_WEIGHT = 0.20;

export function scoreContext(evidence: RepoEvidence): CategoryScore {
  const checks: CheckResult[] = [
    {
      id: "has_architecture_docs",
      passed: evidence.files.hasArchitectureDocs,
      weight: 0.35,
      label: "Architecture docs exist",
      failureNote: evidence.files.hasArchitectureDocs
        ? undefined
        : "No ARCHITECTURE.md or docs/architecture.* found — agents cannot build a stable mental model of the codebase structure from documentation.",
    },
    {
      id: "has_docs_dir",
      passed: evidence.files.hasDocsDir,
      weight: 0.25,
      label: "docs/ directory exists",
      failureNote: evidence.files.hasDocsDir
        ? undefined
        : "No docs/ directory found — there is no structured location for project documentation the agent can reference.",
    },
    {
      id: "has_tsconfig",
      passed: evidence.context.hasTsConfig,
      weight: 0.25,
      label: "tsconfig.json present",
      failureNote: evidence.context.hasTsConfig
        ? undefined
        : "No tsconfig.json found — the agent cannot determine the TypeScript configuration, module system, or compiler targets for this project.",
    },
    {
      id: "has_env_example",
      passed: evidence.files.hasEnvExample,
      weight: 0.15,
      label: ".env.example present",
      failureNote: evidence.files.hasEnvExample
        ? undefined
        : "No .env.example found — agents may create or modify code that references environment variables without knowing which are required or what format they take.",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passingWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 50) / 10 : 0;

  const failingChecks = checks.filter((c) => !c.passed);

  return {
    id: "context",
    label: "Context",
    score,
    maxScore: 5,
    checks,
    failingChecks,
  };
}

export { CATEGORY_WEIGHT as CONTEXT_WEIGHT };
