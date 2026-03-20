import { writeFile } from "fs/promises";
import type { AuditReport } from "../types.js";

export async function reportJson(report: AuditReport, outputFile?: string): Promise<void> {
  const json = JSON.stringify(report, null, 2);

  if (outputFile) {
    await writeFile(outputFile, json, "utf-8");
    process.stdout.write(`Report written to: ${outputFile}\n`);
  } else {
    process.stdout.write(json + "\n");
  }
}
