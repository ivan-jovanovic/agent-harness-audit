import type {
  AuditInput,
  RepoEvidence,
  CategoryScore,
  CheckResult,
  TargetTool,
  DeepCheckOverrides,
} from "../../types.js";

const CATEGORY_WEIGHT = 0.20;
const NATIVE_SKILL_TOOLS: TargetTool[] = ["claude-code", "cursor"];

type InstructionsInput = Pick<AuditInput, "toolsRequested" | "toolsResolved"> & {
  deepOverrides?: DeepCheckOverrides;
};

function singleSelectedTool(toolsResolved: TargetTool[] | undefined): TargetTool | undefined {
  if (!toolsResolved || toolsResolved.length !== 1) return undefined;
  return toolsResolved[0];
}

function supportedToolSkills(toolsResolved: TargetTool[] | undefined): TargetTool[] {
  if (!toolsResolved || toolsResolved.length === 0) return [];
  return toolsResolved.filter((tool) => NATIVE_SKILL_TOOLS.includes(tool));
}

function isNativeSkillTool(tool: TargetTool | undefined): tool is "claude-code" | "cursor" {
  return tool !== undefined && NATIVE_SKILL_TOOLS.includes(tool);
}

function hasSelectedToolSkills(evidence: RepoEvidence, tool: TargetTool | undefined): boolean {
  if (tool === "claude-code") return evidence.files.hasClaudeSkills;
  if (tool === "cursor") return evidence.files.hasCursorSkills;
  return false;
}

function singleNativeInstructionTool(evidence: RepoEvidence): TargetTool | undefined {
  const tools: TargetTool[] = [];

  if (evidence.files.hasCLAUDEMd || evidence.files.hasClaudeSkills) {
    tools.push("claude-code");
  }

  if (evidence.files.hasCursorSkills) {
    tools.push("cursor");
  }

  if (tools.length !== 1) return undefined;
  return tools[0];
}

function hasPrimaryInstructions(
  evidence: RepoEvidence,
  tool: TargetTool | undefined,
  selectedTools: TargetTool[]
): boolean {
  if (evidence.files.hasAgentsMd) return true;

  if (tool === "claude-code" && evidence.files.hasCLAUDEMd) {
    return true;
  }

  if (
    evidence.files.hasCLAUDEMd &&
    selectedTools.length > 0 &&
    selectedTools.every((selectedTool) => hasSelectedToolSkills(evidence, selectedTool))
  ) {
    return true;
  }

  const nativeTool = singleNativeInstructionTool(evidence);
  return nativeTool === "claude-code" && evidence.files.hasCLAUDEMd;
}

function formatMissingToolSkills(tools: TargetTool[]): string {
  const missingPaths: string[] = [];
  if (tools.includes("claude-code")) {
    missingPaths.push(".claude/skills/**/SKILL.md");
  }
  if (tools.includes("cursor")) {
    missingPaths.push(".cursor/skills/**/SKILL.md");
  }
  return missingPaths.join(" and ");
}

export function scoreInstructions(evidence: RepoEvidence, input?: InstructionsInput): CategoryScore {
  const overrides: DeepCheckOverrides | undefined = input?.deepOverrides;
  const singleTool = singleSelectedTool(input?.toolsResolved);
  const selectedTools = supportedToolSkills(input?.toolsResolved);
  const hasToolSkillsCheck = selectedTools.length > 0;
  const omitGenericSkills = isNativeSkillTool(singleTool) && hasSelectedToolSkills(evidence, singleTool);
  const passesPrimaryInstructions =
    hasPrimaryInstructions(evidence, singleTool, selectedTools) ||
    overrides?.has_primary_instructions === true;
  const hasReadme = evidence.files.hasReadme || overrides?.has_readme === true;

  const checks: CheckResult[] = [
    {
      id: "has_primary_instructions",
      passed: passesPrimaryInstructions,
      weight: 0.50,
      label: "Primary instructions present",
      failureNote: passesPrimaryInstructions
        ? undefined
        : singleTool === "claude-code"
          ? "No AGENTS.md or CLAUDE.md found at project root — Claude-only workflows still need a primary instruction surface."
          : "No AGENTS.md found at project root — the agent starts every session with no project-specific operating rules.",
    },
    {
      id: "has_readme",
      passed: hasReadme,
      weight: 0.10,
      label: "README present",
      failureNote: hasReadme
        ? undefined
        : "No README.md found — agents have no onboarding document to orient from before exploring the codebase.",
    },
  ];

  if (!omitGenericSkills) {
    const hasGenericSkills = evidence.files.hasGenericSkills || overrides?.has_generic_skills === true;
    checks.push({
      id: "has_generic_skills",
      passed: hasGenericSkills,
      weight: 0.10,
      label: "Generic skills present",
      failureNote: hasGenericSkills
        ? undefined
        : "No .agents/skills/**/SKILL.md found — reusable generic project skills are missing.",
    });
  }

  if (hasToolSkillsCheck) {
    const missingTools = selectedTools.filter((tool) => {
      if (tool === "claude-code") return !evidence.files.hasClaudeSkills;
      if (tool === "cursor") return !evidence.files.hasCursorSkills;
      return false;
    });
    const hasToolSkills = missingTools.length === 0 || overrides?.has_tool_skills === true;

    checks.push({
      id: "has_tool_skills",
      passed: hasToolSkills,
      weight: 0.30,
      label: "Tool skills present",
      failureNote:
        hasToolSkills
          ? undefined
          : `No ${formatMissingToolSkills(missingTools)} found for selected tool(s) — targeted skills are missing.`,
    });
  }

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
