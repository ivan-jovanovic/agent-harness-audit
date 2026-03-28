#!/usr/bin/env node

import { resolve } from "node:path";
import minimist from "minimist";
import type {
  AuditInput,
  TargetTool,
  SafetyLevel,
  AgentName,
  ToolsRequested,
  CliErrorEnvelope,
} from "./types.js";
import { AuditUsageError } from "./types.js";
import { runAuditCommand } from "./commands/audit.js";

const HELP = `\
Usage: agent-harness <command> [path] [options]

Commands:
  audit <path>   Audit a project directory for agent-readiness
                 Defaults to current working directory if no path given

Options:
  --tools <list|all>     Target tool ecosystems: claude-code, codex, cursor, copilot, other, all
                         Default: all
  --tool <name>          Deprecated alias for --tools <name>
  --failure-mode <text>  Describe what is currently failing (free text)
  --safety-level <lvl>   low | medium | high  (default: medium)
  --deep                 Run deep audit using a supported coding agent
  --agent <name>         Agent to use for deep audit: claude-code, codex
  --tokens               Show token usage instead of cost in deep mode
  --verbose              Enable verbose output
  --debug                Show debug details on errors
  --no-color             Disable ANSI colors in terminal output
  --json                 Output machine-readable JSON instead of terminal report
  --write-artifacts      Write starter files into the target directory
  --output <file>        Write JSON output to a file (requires --json)
  --version              Print version number
  --help                 Show this help

Examples:
  agent-harness audit .
  agent-harness audit /path/to/repo --tools claude-code,codex
  agent-harness audit . --deep
  agent-harness audit . --json --output report.json
  agent-harness audit . --write-artifacts
`;

const VALID_TOOLS: TargetTool[] = ["claude-code", "codex", "cursor", "copilot", "other"];
const VALID_AGENTS: AgentName[] = ["claude-code", "codex"];
const VALID_SAFETY_LEVELS: SafetyLevel[] = ["low", "medium", "high"];

async function emitError(
  message: string,
  exitCode: number,
  jsonMode: boolean,
  agent?: AgentName,
  code: CliErrorEnvelope["error"]["code"] = "usage_error",
): Promise<never> {
  if (jsonMode) {
    const envelope: CliErrorEnvelope = {
      error: {
        code,
        message,
        ...(agent ? { agent } : {}),
      },
    };
    return await new Promise<never>((resolve) => {
      process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`, () => {
        process.exit(exitCode);
        resolve(undefined as never);
      });
    });
  }

  process.stderr.write(`Error: ${message}\n`);
  process.exit(exitCode);
}

async function parseTools(
  rawTools: string | undefined,
  rawTool: string | undefined,
  jsonMode: boolean,
): Promise<{
  toolsRequested: ToolsRequested;
  toolsResolved: TargetTool[];
}> {
  if (rawTools && rawTool) {
    await emitError("use either --tools or --tool, not both", 2, jsonMode);
  }

  if (rawTool) {
    if (!VALID_TOOLS.includes(rawTool as TargetTool)) {
      await emitError(`--tool must be one of: ${VALID_TOOLS.join(", ")}. Got: ${rawTool}`, 2, jsonMode);
    }
    process.stderr.write("Warning: --tool is deprecated; use --tools instead\n");
    return {
      toolsRequested: [rawTool as TargetTool],
      toolsResolved: [rawTool as TargetTool],
    };
  }

  if (!rawTools || rawTools === "all") {
    return {
      toolsRequested: "all",
      toolsResolved: [...VALID_TOOLS],
    };
  }

  const requested = rawTools
    .split(",")
    .map((tool) => tool.trim())
    .filter((tool) => tool.length > 0);

  if (requested.length === 0) {
    await emitError("--tools must not be empty", 2, jsonMode);
  }

  if (requested.includes("all")) {
    await emitError("--tools cannot combine 'all' with specific tools", 2, jsonMode);
  }

  const invalid = requested.filter((tool) => !VALID_TOOLS.includes(tool as TargetTool));
  if (invalid.length > 0) {
    await emitError(
      `--tools must be one of: ${VALID_TOOLS.join(", ")}, all. Got: ${invalid.join(", ")}`,
      2,
      jsonMode,
    );
  }

  const unique = [...new Set(requested)] as TargetTool[];
  return {
    toolsRequested: unique,
    toolsResolved: unique,
  };
}

export async function parseArgs(argv: string[]): Promise<{ command: string; input: AuditInput }> {
  const args = minimist(argv.slice(2), {
    boolean: [
      "help",
      "version",
      "json",
      "write-artifacts",
      "deep",
      "tokens",
      "verbose",
      "debug",
      "no-color",
    ],
    string: ["tool", "tools", "failure-mode", "safety-level", "output", "agent"],
    alias: {
      h: "help",
      v: "version",
    },
    default: {
      "safety-level": "medium",
      json: false,
      "write-artifacts": false,
      deep: false,
      tokens: false,
      verbose: false,
      debug: false,
      "no-color": false,
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
    await emitError("no command specified. Run agent-harness --help for usage.", 2, Boolean(args.json));
  }

  const { toolsRequested, toolsResolved } = await parseTools(
    args["tools"] as string | undefined,
    args["tool"] as string | undefined,
    Boolean(args.json),
  );

  const agentName = args["agent"] as string | undefined;
  if (agentName && !VALID_AGENTS.includes(agentName as AgentName)) {
    await emitError(
      `--agent must be one of: ${VALID_AGENTS.join(", ")}. Got: ${agentName}`,
      2,
      Boolean(args.json),
    );
  }

  const safetyLevel = args["safety-level"] as string;
  if (!VALID_SAFETY_LEVELS.includes(safetyLevel as SafetyLevel)) {
    await emitError(
      `--safety-level must be one of: ${VALID_SAFETY_LEVELS.join(", ")}. Got: ${safetyLevel}`,
      2,
      Boolean(args.json),
    );
  }

  if (args["output"] && !args["json"]) {
    await emitError("--output requires --json", 2, Boolean(args.json));
  }

  const targetPath = pathArg ? resolve(pathArg) : resolve(".");

  const input: AuditInput = {
    path: targetPath,
    toolsRequested,
    toolsResolved,
    failureMode: args["failure-mode"] as string | undefined,
    safetyLevel: safetyLevel as SafetyLevel,
    jsonMode: args["json"] as boolean,
    writeArtifacts: args["write-artifacts"] as boolean,
    outputFile: args["output"] as string | undefined,
    deep: args["deep"] as boolean,
    agentName: agentName as AgentName | undefined,
    tokens: args["tokens"] as boolean,
    verbose: args["verbose"] as boolean,
    debug: args["debug"] as boolean,
    noColor: args["no-color"] as boolean,
  };

  return { command, input };
}

async function main(): Promise<void> {
  const { command, input } = await parseArgs(process.argv);

  try {
    if (command === "audit") {
      await runAuditCommand(input);
      return;
    }

    await emitError(`unknown command "${command}". Run agent-harness --help for usage.`, 2, input.jsonMode);
  } catch (err: unknown) {
    if (input.jsonMode) {
      const message = err instanceof Error ? err.message : String(err);
      const agent = err instanceof AuditUsageError ? err.agent ?? input.agentName : input.agentName;
      const code = err instanceof AuditUsageError ? "usage_error" : "unexpected_error";
      await emitError(message, err instanceof AuditUsageError ? 2 : 3, true, agent, code);
    }
    throw err;
  }
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
