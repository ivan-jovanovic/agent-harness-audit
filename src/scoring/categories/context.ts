import type { RepoEvidence, CategoryScore, CheckResult, DeepCheckOverrides } from "../../types.js";

const CATEGORY_WEIGHT = 0.20;

export function scoreContext(evidence: RepoEvidence, deepOverrides?: DeepCheckOverrides): CategoryScore {
  const hasArchitectureDocs =
    evidence.files.hasArchitectureDocs || deepOverrides?.has_architecture_docs === true;
  const hasDocsIndex = evidence.files.hasDocsIndex || deepOverrides?.has_docs_index === true;
  const hasDocsDir = evidence.files.hasDocsDir || deepOverrides?.has_docs_dir === true;
  const hasTsconfig = evidence.context.hasTsConfig || deepOverrides?.has_tsconfig === true;
  const hasEnvExample = evidence.files.hasEnvExample || deepOverrides?.has_env_example === true;

  const checks: CheckResult[] = [
    {
      id: "has_architecture_docs",
      passed: hasArchitectureDocs,
      weight: 0.30,
      label: "Architecture docs exist",
      failureNote: hasArchitectureDocs
        ? undefined
        : "No discoverable architecture guide found at the repo root or in docs/ — agents cannot build a stable mental model of the codebase structure from documentation.",
    },
    {
      id: "has_docs_index",
      passed: hasDocsIndex,
      weight: 0.20,
      label: "docs index exists",
      failureNote: hasDocsIndex
        ? undefined
        : "No docs index found under docs/ — agents have no clear entrypoint into the repository's documentation set.",
    },
    {
      id: "has_docs_dir",
      passed: hasDocsDir,
      weight: 0.20,
      label: "docs/ directory exists",
      failureNote: hasDocsDir
        ? undefined
        : "No docs/ directory found — there is no structured location for project documentation the agent can reference.",
    },
    {
      id: "has_tsconfig",
      passed: hasTsconfig,
      weight: 0.20,
      label: "tsconfig.json present",
      failureNote: hasTsconfig
        ? undefined
        : "No tsconfig.json found — the agent cannot determine the TypeScript configuration, module system, or compiler targets for this project.",
    },
    {
      id: "has_env_example",
      passed: hasEnvExample,
      weight: 0.10,
      label: ".env.example present",
      failureNote: hasEnvExample
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
