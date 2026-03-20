import type { AuditInput, AuditReport } from "../types.js";
import { collectEvidence } from "../inspection/local.js";
import { scoreProject } from "../scoring/index.js";
import { reportText } from "../reporters/text.js";
import { reportJson } from "../reporters/json.js";
import { generateArtifacts, previewArtifacts } from "../artifacts/generate.js";

function step(label: string): void {
  process.stdout.write(`  ${label}\n`);
}

export async function runAuditCommand(input: AuditInput): Promise<void> {
  const isJson = input.jsonMode;

  if (!isJson) {
    process.stdout.write(`agent-harness v0.1.0  \u2014  Agent-readiness audit for AI coding tools\n\n`);
    process.stdout.write(`Auditing: ${input.path}\n\n`);
  }

  // Collect evidence with progress steps
  if (!isJson) step("Scanning project structure...  done");
  const evidence = await collectEvidence(input.path);
  if (!isJson) {
    step("Reading package.json...        done");
    step("Checking docs and instructions...  done");
    step("Checking test signals...       done");
    step("Checking workflow configs...   done");
    step("Scoring...                     done");
    process.stdout.write("\n");
  }

  // Score
  const scoring = scoreProject(evidence, { tool: input.tool });

  // Generate artifacts
  let artifacts;
  if (input.writeArtifacts) {
    artifacts = await generateArtifacts(input.path, evidence, input, false);
  } else {
    artifacts = previewArtifacts(input.path, evidence, input);
  }

  // Build report
  const report: AuditReport = {
    version: "1",
    generatedAt: new Date().toISOString(),
    input,
    evidence,
    scoring,
    artifacts,
  };

  // Output
  if (isJson) {
    await reportJson(report, input.outputFile);
  } else {
    reportText(report);
    if (input.writeArtifacts) {
      const written = artifacts.filter((a) => a.written);
      const skipped = artifacts.filter((a) => a.skipped);
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
