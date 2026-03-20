import type { AuditInput, AuditReport } from "../types.js";
import { collectEvidence } from "../inspection/local.js";
import { scoreProject } from "../scoring/index.js";
import { reportText } from "../reporters/text.js";
import { reportJson } from "../reporters/json.js";

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

  // Build report
  const report: AuditReport = {
    version: "1",
    generatedAt: new Date().toISOString(),
    input,
    evidence,
    scoring,
    artifacts: [],
  };

  // Output
  if (isJson) {
    await reportJson(report, input.outputFile);
  } else {
    reportText(report);
  }

  process.exit(0);
}
