import type { RepoEvidence, CategoryScore, CheckResult, AuditInput } from "../../types.js";

const CATEGORY_WEIGHT = 0.25;

export function scoreInstructions(evidence: RepoEvidence, input: Pick<AuditInput, "tool">): CategoryScore {
  const isClaudeCode = input.tool === "claude-code";

  const checks: CheckResult[] = [
    {
      id: "has_agents_md",
      passed: evidence.files.hasAgentsMd,
      weight: 0.35,
      label: "AGENTS.md present",
      failureNote: evidence.files.hasAgentsMd
        ? undefined
        : "No AGENTS.md found at project root — the agent starts every session with no project-specific operating rules.",
    },
    {
      id: "has_claude_md",
      passed: evidence.files.hasCLAUDEMd,
      weight: isClaudeCode ? 0.40 : 0.25,
      label: "CLAUDE.md present",
      failureNote: evidence.files.hasCLAUDEMd
        ? undefined
        : "No CLAUDE.md found — Claude Code will not load any project-level configuration at startup.",
    },
    {
      id: "has_readme",
      passed: evidence.files.hasReadme,
      weight: 0.25,
      label: "README present",
      failureNote: evidence.files.hasReadme
        ? undefined
        : "No README.md found — agents have no onboarding document to orient from before exploring the codebase.",
    },
    {
      id: "has_contributing",
      passed: evidence.files.hasContributing,
      weight: isClaudeCode ? 0.00 : 0.15,
      label: "CONTRIBUTING.md present",
      failureNote: evidence.files.hasContributing
        ? undefined
        : "No CONTRIBUTING.md found — agents have no documented contribution model to follow (branch strategy, commit conventions, review process).",
    },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const passingWeight = checks.filter((c) => c.passed).reduce((sum, c) => sum + c.weight, 0);
  const score = totalWeight > 0 ? Math.round((passingWeight / totalWeight) * 50) / 10 : 0;

  const failingChecks = checks.filter((c) => !c.passed);

  return {
    id: "instructions",
    label: "Instructions",
    score,
    maxScore: 5,
    checks,
    failingChecks,
  };
}

export { CATEGORY_WEIGHT as INSTRUCTIONS_WEIGHT };
