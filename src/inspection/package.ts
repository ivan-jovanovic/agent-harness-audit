import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { PackageSignals } from "../types.js";

export async function parsePackageSignals(projectPath: string): Promise<PackageSignals> {
  const packageJsonPath = join(projectPath, "package.json");

  const hasPackageJson = existsSync(packageJsonPath);

  const lockfileChecks = [
    { file: "package-lock.json", type: "npm" as const },
    { file: "pnpm-lock.yaml", type: "pnpm" as const },
    { file: "yarn.lock", type: "yarn" as const },
  ];

  let hasLockfile = false;
  let lockfileType: PackageSignals["lockfileType"] = undefined;
  for (const { file, type } of lockfileChecks) {
    if (existsSync(join(projectPath, file))) {
      hasLockfile = true;
      lockfileType = type;
      break;
    }
  }

  const scripts = { hasLint: false, hasTypecheck: false, hasTest: false, hasBuild: false };

  if (hasPackageJson) {
    try {
      const raw = await readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(raw) as { scripts?: Record<string, unknown> };
      const s = pkg.scripts ?? {};
      scripts.hasLint = "lint" in s;
      scripts.hasTypecheck = "typecheck" in s;
      scripts.hasTest = "test" in s;
      scripts.hasBuild = "build" in s;
    } catch {
      // malformed package.json — treat scripts as absent
    }
  }

  return { hasPackageJson, hasLockfile, lockfileType, scripts };
}
