import { readdir, readFile } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import type { PackageSignals } from "../types.js";

const LOCAL_DEV_BOOT_SCRIPT_RE = /^(dev|start|preview|serve)(:.*)?$/i;
const LOCAL_DEV_BOOT_COMMAND_RE =
  /^(next dev|vite dev|vite preview|remix dev|astro dev|nuxt dev|react-scripts start|webpack serve|serve(?:\s|$))/i;
const BUILD_LIKE_COMMAND_RE = /\b(build|bundle|compile|minify)\b/i;
const ARCHITECTURE_LINT_CONFIG_FILES = [
  ".dependency-cruiser.js",
  ".dependency-cruiser.cjs",
  ".dependency-cruiser.mjs",
  "dependency-cruiser.config.js",
  "dependency-cruiser.config.cjs",
  "dependency-cruiser.config.mjs",
];
const ARCHITECTURE_LINT_PACKAGE_NAMES = ["dependency-cruiser", "eslint-plugin-boundaries"];
const WORKSPACE_DIR_NAMES = [
  "packages",
  "apps",
  "services",
  "libs",
  "projects",
  "modules",
  "backend",
  "frontend",
  "client",
  "server",
];
const IGNORED_DIR_NAMES = new Set([
  ".git",
  ".idea",
  ".vscode",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
]);

function isReadableDirectory(path: string): boolean {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
}

function hasArchitectureLintConfig(projectPath: string): boolean {
  return ARCHITECTURE_LINT_CONFIG_FILES.some((file) => existsSync(join(projectPath, file)));
}

function hasArchitectureLintDependency(pkg: {
  dependencies?: Record<string, unknown>;
  devDependencies?: Record<string, unknown>;
}): boolean {
  const allDeps = {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
  };

  return ARCHITECTURE_LINT_PACKAGE_NAMES.some((name) => name in allDeps);
}

async function readWorkspacePatterns(projectPath: string): Promise<string[]> {
  const patterns = new Set<string>();
  const packageJsonPath = join(projectPath, "package.json");
  const pnpmWorkspacePath = join(projectPath, "pnpm-workspace.yaml");

  if (existsSync(packageJsonPath)) {
    try {
      const raw = await readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(raw) as {
        workspaces?: string[] | string | { packages?: string[] };
      };
      const workspaces = pkg.workspaces;
      if (Array.isArray(workspaces)) {
        for (const entry of workspaces) {
          if (typeof entry === "string" && entry.trim()) patterns.add(entry.trim());
        }
      } else if (typeof workspaces === "string" && workspaces.trim()) {
        patterns.add(workspaces.trim());
      } else if (
        workspaces &&
        typeof workspaces === "object" &&
        !Array.isArray(workspaces) &&
        Array.isArray(workspaces.packages)
      ) {
        for (const entry of workspaces.packages) {
          if (typeof entry === "string" && entry.trim()) patterns.add(entry.trim());
        }
      }
    } catch {
      // Ignore malformed package.json here; parsePackageSignals will report warnings.
    }
  }

  if (existsSync(pnpmWorkspacePath)) {
    try {
      const raw = await readFile(pnpmWorkspacePath, "utf-8");
      const lines = raw.split(/\r?\n/);
      let inPackagesBlock = false;
      for (const line of lines) {
        const trimmed = line.trim();
        if (/^packages:\s*$/.test(trimmed)) {
          inPackagesBlock = true;
          continue;
        }
        if (inPackagesBlock && /^[a-zA-Z_][\w-]*:\s*$/.test(trimmed)) {
          inPackagesBlock = false;
        }
        if (!inPackagesBlock) continue;

        const match = trimmed.match(/^-\s*["']?(.+?)["']?$/);
        if (match?.[1]) {
          patterns.add(match[1]);
        }
      }
    } catch {
      // Ignore parse issues; fallback discovery still applies.
    }
  }

  return [...patterns];
}

async function expandWorkspacePattern(projectPath: string, pattern: string): Promise<string[]> {
  const trimmed = pattern.trim();
  if (!trimmed) return [];

  if (!trimmed.includes("*")) {
    const candidate = join(projectPath, trimmed);
    return existsSync(join(candidate, "package.json")) ? [candidate] : [];
  }

  const wildcardIndex = trimmed.indexOf("*");
  const basePart = trimmed.slice(0, wildcardIndex).replace(/[\\/]+$/, "");
  const baseDir = join(projectPath, basePart || ".");
  if (!isReadableDirectory(baseDir)) return [];

  const results: string[] = [];
  const entries = await readdir(baseDir, { withFileTypes: true }).catch(() => []);
  for (const entry of entries) {
    if (!entry.isDirectory() || IGNORED_DIR_NAMES.has(entry.name)) continue;
    const candidate = join(baseDir, entry.name);
    if (existsSync(join(candidate, "package.json"))) {
      results.push(candidate);
    }
  }
  return results;
}

async function discoverWorkspacePackageRoots(projectPath: string): Promise<string[]> {
  const discovered = new Set<string>();

  const rootPackageJson = join(projectPath, "package.json");
  if (existsSync(rootPackageJson)) {
    discovered.add(projectPath);
  }

  const patterns = await readWorkspacePatterns(projectPath);
  for (const pattern of patterns) {
    const roots = await expandWorkspacePattern(projectPath, pattern);
    for (const root of roots) discovered.add(root);
  }

  const rootEntries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
  for (const entry of rootEntries) {
    if (!entry.isDirectory() || IGNORED_DIR_NAMES.has(entry.name)) continue;

    const childDir = join(projectPath, entry.name);
    if (existsSync(join(childDir, "package.json"))) {
      discovered.add(childDir);
    }

    if (!WORKSPACE_DIR_NAMES.includes(entry.name)) continue;

    const childEntries = await readdir(childDir, { withFileTypes: true }).catch(() => []);
    for (const child of childEntries) {
      if (!child.isDirectory() || IGNORED_DIR_NAMES.has(child.name)) continue;
      const nestedDir = join(childDir, child.name);
      if (existsSync(join(nestedDir, "package.json"))) {
        discovered.add(nestedDir);
      }
    }
  }

  return [...discovered].sort((a, b) => a.localeCompare(b));
}

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

  const scripts = {
    hasLocalDevBootPath: false,
    hasLint: false,
    hasTypecheck: false,
    hasTest: false,
    hasBuild: false,
  };
  let hasArchitectureLints = hasArchitectureLintConfig(projectPath);
  const warnings: string[] = [];

  if (hasPackageJson) {
    try {
      const raw = await readFile(packageJsonPath, "utf-8");
      const pkg = JSON.parse(raw) as {
        scripts?: Record<string, unknown>;
        dependencies?: Record<string, unknown>;
        devDependencies?: Record<string, unknown>;
      };
      const s = pkg.scripts ?? {};
      scripts.hasLocalDevBootPath = Object.entries(s).some(
        ([name, value]) =>
          typeof value === "string" &&
          ((LOCAL_DEV_BOOT_SCRIPT_RE.test(name) && !BUILD_LIKE_COMMAND_RE.test(value)) ||
            LOCAL_DEV_BOOT_COMMAND_RE.test(value)),
      );
      scripts.hasLint = "lint" in s;
      scripts.hasTypecheck = "typecheck" in s;
      scripts.hasTest = "test" in s;
      scripts.hasBuild = "build" in s;
      hasArchitectureLints = hasArchitectureLints || hasArchitectureLintDependency(pkg);
    } catch {
      warnings.push("package.json exists but could not be parsed");
    }
  }

  return { hasPackageJson, hasLockfile, hasArchitectureLints, lockfileType, scripts, warnings };
}

export async function collectPackageSignals(projectPath: string): Promise<PackageSignals> {
  const roots = await discoverWorkspacePackageRoots(projectPath);
  if (roots.length === 0) {
    return {
      hasPackageJson: false,
      hasLockfile: false,
      hasArchitectureLints: false,
      scripts: {
        hasLocalDevBootPath: false,
        hasLint: false,
        hasTypecheck: false,
        hasTest: false,
        hasBuild: false,
      },
      warnings: [],
    };
  }

  const aggregate: PackageSignals = {
    hasPackageJson: false,
    hasLockfile: false,
    hasArchitectureLints: false,
    lockfileType: undefined,
    scripts: {
      hasLocalDevBootPath: false,
      hasLint: false,
      hasTypecheck: false,
      hasTest: false,
      hasBuild: false,
    },
    warnings: [],
  };
  const warnings = new Set<string>();

  for (const root of roots) {
    const signals = await parsePackageSignals(root);
    aggregate.hasPackageJson = aggregate.hasPackageJson || signals.hasPackageJson;
    aggregate.hasLockfile = aggregate.hasLockfile || signals.hasLockfile;
    aggregate.hasArchitectureLints = aggregate.hasArchitectureLints || signals.hasArchitectureLints;
    aggregate.scripts.hasLocalDevBootPath =
      aggregate.scripts.hasLocalDevBootPath || signals.scripts.hasLocalDevBootPath;
    aggregate.scripts.hasLint = aggregate.scripts.hasLint || signals.scripts.hasLint;
    aggregate.scripts.hasTypecheck = aggregate.scripts.hasTypecheck || signals.scripts.hasTypecheck;
    aggregate.scripts.hasTest = aggregate.scripts.hasTest || signals.scripts.hasTest;
    aggregate.scripts.hasBuild = aggregate.scripts.hasBuild || signals.scripts.hasBuild;
    aggregate.lockfileType = aggregate.lockfileType ?? signals.lockfileType;
    for (const warning of signals.warnings) {
      warnings.add(warning);
    }
  }

  aggregate.warnings = [...warnings];
  return aggregate;
}

export async function discoverPackageRoots(projectPath: string): Promise<string[]> {
  return discoverWorkspacePackageRoots(projectPath);
}
