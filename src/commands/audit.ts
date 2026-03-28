import { stat } from "fs/promises";
import { dirname } from "path";
import type {
  AuditInput,
  AuditReport,
  DeepAuditFinding,
  DeepCheckOverrides,
  RepoEvidence,
  ScoringResult,
} from "../types.js";
import { AuditUsageError } from "../types.js";
import { discoverAgents, getAgentAdapter, selectAgent } from "../agents/index.js";
import { collectEvidence } from "../inspection/local.js";
import { scoreProject } from "../scoring/index.js";
import { reportText } from "../reporters/text.js";
import { reportJson } from "../reporters/json.js";
import { generateArtifacts, previewArtifacts } from "../artifacts/generate.js";

function step(label: string): void {
  process.stdout.write(`  ${label}\n`);
}

function formatToolsRequested(input: AuditInput): string {
  if (input.toolsRequested === "all") {
    return "all";
  }

  return input.toolsRequested.join(", ");
}

interface DeepMergeResult {
  evidence: RepoEvidence;
  overrides: DeepCheckOverrides;
  evidenceByCheckId: Record<string, string>;
}

function cloneEvidence(evidence: RepoEvidence): RepoEvidence {
  return {
    files: { ...evidence.files },
    packages: {
      ...evidence.packages,
      scripts: { ...evidence.packages.scripts },
      warnings: [...evidence.packages.warnings],
    },
    tests: { ...evidence.tests },
    workflows: { ...evidence.workflows },
    context: { ...evidence.context },
    warnings: [...evidence.warnings],
  };
}

export function mergeDeepFindings(
  evidence: RepoEvidence,
  findings: DeepAuditFinding[],
): DeepMergeResult {
  const merged = cloneEvidence(evidence);
  const overrides: DeepCheckOverrides = {};
  const evidenceByCheckId: Record<string, string> = {};

  for (const finding of findings) {
    if (finding.evidence) {
      evidenceByCheckId[finding.checkId] = finding.evidence;
    }
    if (!finding.passed) continue;

    switch (finding.checkId) {
      case "has_primary_instructions":
        overrides[finding.checkId] = true;
        break;
      case "has_readme":
        merged.files.hasReadme = true;
        break;
      case "has_generic_skills":
        merged.files.hasGenericSkills = true;
        break;
      case "has_tool_skills":
        // This check is aggregate across selected tools. Do not infer per-tool
        // skill files from a single pass result.
        overrides[finding.checkId] = true;
        break;
      case "has_architecture_docs":
        merged.files.hasArchitectureDocs = true;
        break;
      case "has_docs_index":
        merged.files.hasDocsIndex = true;
        break;
      case "has_docs_dir":
        merged.files.hasDocsDir = true;
        break;
      case "has_tsconfig":
        merged.context.hasTsConfig = true;
        break;
      case "has_env_example":
        merged.files.hasEnvExample = true;
        break;
      case "has_package_json":
        merged.packages.hasPackageJson = true;
        break;
      case "has_lockfile":
        merged.packages.hasLockfile = true;
        break;
      case "has_lint_script":
        merged.packages.scripts.hasLint = true;
        break;
      case "has_typecheck_script":
        merged.packages.scripts.hasTypecheck = true;
        break;
      case "has_build_script":
        merged.packages.scripts.hasBuild = true;
        break;
      case "has_test_script":
        merged.packages.scripts.hasTest = true;
        break;
      case "has_test_dir":
        merged.tests.hasTestDir = true;
        break;
      case "has_test_files":
        merged.tests.hasTestFiles = true;
        break;
      default:
        break;
    }
  }

  return { evidence: merged, overrides, evidenceByCheckId };
}

function attachDeepEvidence(scoring: ScoringResult, evidenceByCheckId: Record<string, string>): void {
  for (const category of scoring.categoryScores) {
    for (const check of category.checks) {
      const evidence = evidenceByCheckId[check.id];
      if (evidence) {
        check.evidence = evidence;
      }
    }
    for (const check of category.failingChecks) {
      const evidence = evidenceByCheckId[check.id];
      if (evidence) {
        check.evidence = evidence;
      }
    }
  }

  for (const readiness of scoring.toolReadiness) {
    if (!readiness.checks) continue;
    for (const check of readiness.checks) {
      const evidence = evidenceByCheckId[check.id];
      if (evidence) {
        check.evidence = evidence;
      }
    }
  }
}

export async function runAudit(input: AuditInput): Promise<AuditReport> {
  const evidence = await collectEvidence(input.path);
  let evidenceForScoring = evidence;
  let deepOverrides: DeepCheckOverrides = {};
  let deepAudit: AuditReport["deepAudit"] = undefined;
  let evidenceByCheckId: Record<string, string> = {};

  if (input.deep) {
    const discovery = await discoverAgents();
    const selected = selectAgent(discovery, input.agentName);
    if (!selected) {
      if (input.agentName) {
        throw new AuditUsageError(`requested agent is not available: ${input.agentName}`);
      }
      throw new AuditUsageError("no supported agent found for --deep (expected claude or codex in PATH)");
    }

    const adapter = getAgentAdapter(selected);
    deepAudit = await adapter.invoke(input.path, evidence);

    const merged = mergeDeepFindings(evidence, deepAudit.findings);
    evidenceForScoring = merged.evidence;
    deepOverrides = merged.overrides;
    evidenceByCheckId = merged.evidenceByCheckId;
  }

  const scoring = scoreProject(
    evidenceForScoring,
    {
      toolsRequested: input.toolsRequested,
      toolsResolved: input.toolsResolved,
    },
    deepOverrides,
  );

  if (input.deep) {
    attachDeepEvidence(scoring, evidenceByCheckId);
  }

  const artifacts = input.writeArtifacts
    ? await generateArtifacts(input.path, evidenceForScoring, input, false)
    : previewArtifacts(input.path, evidenceForScoring, input);

  return {
    version: "2",
    generatedAt: new Date().toISOString(),
    input,
    evidence: evidenceForScoring,
    scoring,
    artifacts,
    deepAudit,
  };
}

export async function runAuditCommand(input: AuditInput): Promise<void> {
  const isJson = input.jsonMode;

  // Validate --output parent directory exists before doing any work
  if (input.outputFile) {
    const outputDir = dirname(input.outputFile);
    try {
      const s = await stat(outputDir);
      if (!s.isDirectory()) {
        throw new AuditUsageError(`output directory does not exist: ${outputDir}`);
      }
    } catch (err) {
      if (err instanceof AuditUsageError) throw err;
      throw new AuditUsageError(`output directory does not exist: ${outputDir}`);
    }
  }

  if (!isJson) {
    process.stdout.write(`agent-harness v0.1.0  \u2014  Agent-readiness audit for AI coding tools\n\n`);
    process.stdout.write(`Auditing: ${input.path}\n\n`);
    process.stdout.write(`Target tools: ${formatToolsRequested(input)}\n\n`);
    if (input.deep) {
      process.stdout.write("Deep mode: enabled\n\n");
    }
  }

  const report = await runAudit(input);

  if (!isJson) {
    step("Scanning project structure...  done");
    step("Reading package signals...      done");
    step("Checking docs and instructions...  done");
    step("Checking test signals...       done");
    if (input.deep) {
      step(`Running deep audit (${report.deepAudit?.agentName ?? "agent"})...  done`);
    }
    step("Scoring...                     done");
    process.stdout.write("\n");
  }

  // Output
  if (isJson) {
    await reportJson(report, input.outputFile);
  } else {
    reportText(report);
    if (input.writeArtifacts) {
      const written = report.artifacts.filter((a) => a.written);
      const skipped = report.artifacts.filter((a) => a.skipped);
      if (written.length > 0) {
        process.stdout.write(`\nGenerated ${written.length} starter file(s):\n`);
        for (const a of written) {
          process.stdout.write(`  ✓ ${a.filename}\n`);
        }
      }
      if (skipped.length > 0) {
        process.stdout.write(`\nSkipped ${skipped.length} file(s) (already exist):\n`);
        for (const a of skipped) {
          process.stdout.write(`  — ${a.filename}\n`);
        }
      }
    }
  }

  process.exit(0);
}
