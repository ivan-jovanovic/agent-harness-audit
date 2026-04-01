import { writeFile } from "fs/promises";
import type { AuditReport } from "../types.js";

export function serializeJsonReport(report: AuditReport): string {
  return JSON.stringify(report, null, 2);
}

export async function reportJson(report: AuditReport, outputFile?: string): Promise<void> {
  const json = serializeJsonReport(report);

  if (outputFile) {
    await writeFile(outputFile, json, "utf-8");
    process.stdout.write(`Report written to: ${outputFile}\n`);
  } else {
    process.stdout.write(json + "\n");
  }
}
