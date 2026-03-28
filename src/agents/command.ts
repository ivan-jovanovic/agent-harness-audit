import { spawn } from "node:child_process";

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  signal: NodeJS.Signals | null;
  durationMs: number;
}

export class CommandTimeoutError extends Error {
  constructor(command: string, timeoutMs: number) {
    super(`command timed out after ${timeoutMs}ms: ${command}`);
    this.name = "CommandTimeoutError";
  }
}

interface RunCommandOptions {
  cwd?: string;
  timeoutMs: number;
  env?: NodeJS.ProcessEnv;
}

function formatCommand(command: string, args: string[]): string {
  const parts = [command, ...args];
  return parts
    .map((part) => (part.length === 0 ? '""' : JSON.stringify(part)))
    .join(" ");
}

export async function runCommand(
  command: string,
  args: string[],
  options: RunCommandOptions,
): Promise<CommandResult> {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, ...(options.env ?? {}) },
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => {
        if (child.exitCode === null && child.signalCode === null) {
          child.kill("SIGKILL");
        }
      }, 250);
    }, options.timeoutMs);

    child.stdout.setEncoding("utf-8");
    child.stderr.setEncoding("utf-8");
    child.stdout.on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk: string) => {
      stderr += chunk;
    });

    child.on("error", (err) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;
      reject(err);
    });

    child.on("close", (exitCode, signal) => {
      clearTimeout(timeout);
      if (settled) return;
      settled = true;

      if (timedOut) {
        reject(new CommandTimeoutError(formatCommand(command, args), options.timeoutMs));
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode,
        signal,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}
