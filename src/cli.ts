#!/usr/bin/env node

import { resolve } from "node:path";
import minimist from "minimist";
import type { AuditInput, AgentTool, SafetyLevel } from "./types.js";
import { AuditUsageError } from "./types.js";
import { runAuditCommand } from "./commands/audit.js";

const HELP = `\
Usage: agent-harness <command> [path] [options]

Commands:
  audit <path>   Audit a project directory for agent-readiness
                 Defaults to current working directory if no path given

Options:
  --tool <name>          AI tool in use: claude-code, cursor, copilot, codex, other
                         Default: other
  --failure-mode <text>  Describe what is currently failing (free text)
  --safety-level <lvl>   low | medium | high  (default: medium)
  --json                 Output machine-readable JSON instead of terminal report
  --write-artifacts      Write starter files into the target directory
  --output <file>        Write JSON output to a file (requires --json)
  --version              Print version number
  --help                 Show this help

Examples:
  agent-harness audit .
  agent-harness audit /path/to/repo --tool claude-code
  agent-harness audit . --json --output report.json
  agent-harness audit . --write-artifacts
`;

const VALID_TOOLS: AgentTool[] = ["claude-code", "cursor", "copilot", "codex", "other"];
const VALID_SAFETY_LEVELS: SafetyLevel[] = ["low", "medium", "high"];

export function parseArgs(argv: string[]): { command: string; input: AuditInput } {
  const args = minimist(argv.slice(2), {
    boolean: ["help", "version", "json", "write-artifacts"],
    string: ["tool", "failure-mode", "safety-level", "output"],
    alias: {
      h: "help",
      v: "version",
    },
    default: {
      tool: "other",
      "safety-level": "medium",
      json: false,
      "write-artifacts": false,
    },
  });

  if (args.help) {
    process.stdout.write(HELP);
    process.exit(0);
  }

  if (args.version) {
    process.stdout.write("0.1.0\n");
    process.exit(0);
  }

  const [command, pathArg] = args._ as string[];

  if (!command) {
    process.stderr.write("Error: no command specified. Run agent-harness --help for usage.\n");
    process.exit(2);
  }

  const tool = args["tool"] as string;
  if (!VALID_TOOLS.includes(tool as AgentTool)) {
    process.stderr.write(
      `Error: --tool must be one of: ${VALID_TOOLS.join(", ")}. Got: ${tool}\n`,
    );
    process.exit(2);
  }

  const safetyLevel = args["safety-level"] as string;
  if (!VALID_SAFETY_LEVELS.includes(safetyLevel as SafetyLevel)) {
    process.stderr.write(
      `Error: --safety-level must be one of: ${VALID_SAFETY_LEVELS.join(", ")}. Got: ${safetyLevel}\n`,
    );
    process.exit(2);
  }

  if (args["output"] && !args["json"]) {
    process.stderr.write("Error: --output requires --json\n");
    process.exit(2);
  }

  const targetPath = pathArg ? resolve(pathArg) : resolve(".");

  const input: AuditInput = {
    path: targetPath,
    tool: tool as AgentTool,
    failureMode: args["failure-mode"] as string | undefined,
    safetyLevel: safetyLevel as SafetyLevel,
    jsonMode: args["json"] as boolean,
    writeArtifacts: args["write-artifacts"] as boolean,
    outputFile: args["output"] as string | undefined,
  };

  return { command, input };
}

async function main(): Promise<void> {
  const { command, input } = parseArgs(process.argv);

  if (command === "audit") {
    await runAuditCommand(input);
    return;
  }

  process.stderr.write(`Error: unknown command "${command}". Run agent-harness --help for usage.\n`);
  process.exit(2);
}

main().catch((err: unknown) => {
  if (err instanceof AuditUsageError) {
    process.stderr.write(`Error: ${err.message}\n`);
    process.exit(2);
  }
  const message = err instanceof Error ? err.message : String(err);
  process.stderr.write(`Unexpected error: ${message}\n`);
  process.exit(3);
});
