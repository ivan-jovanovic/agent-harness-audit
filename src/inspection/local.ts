import { readdir, stat, readFile } from "fs/promises";
import { join } from "path";
import type {
  RepoEvidence,
  FileSignals,
  TestSignals,
  WorkflowSignals,
  ContextSignals,
} from "../types.js";
import { parsePackageSignals } from "./package.js";

async function exists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function isDir(p: string): Promise<boolean> {
  try {
    const s = await stat(p);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function collectFileSignals(projectPath: string): Promise<FileSignals> {
  const [
    hasAgentsMd,
    hasCLAUDEMd,
    hasReadme,
    hasContributing,
    hasEnvExample,
    hasDocsDir,
    hasArchMd,
    hasDocsArchitecture,
  ] = await Promise.all([
    exists(join(projectPath, "AGENTS.md")),
    exists(join(projectPath, "CLAUDE.md")),
    (async () =>
      (await exists(join(projectPath, "README.md"))) ||
      (await exists(join(projectPath, "README"))))(),
    exists(join(projectPath, "CONTRIBUTING.md")),
    exists(join(projectPath, ".env.example")),
    isDir(join(projectPath, "docs")),
    exists(join(projectPath, "ARCHITECTURE.md")),
    (async () => {
      const docsDir = join(projectPath, "docs");
      if (!(await isDir(docsDir))) return false;
      try {
        const entries = await readdir(docsDir);
        return entries.some((f) => f.startsWith("architecture"));
      } catch {
        return false;
      }
    })(),
  ]);

  const hasArchitectureDocs = hasArchMd || hasDocsArchitecture;

  return {
    hasAgentsMd,
    hasCLAUDEMd,
    hasReadme,
    hasContributing,
    hasArchitectureDocs,
    hasEnvExample,
    hasDocsDir,
  };
}

async function collectTestSignals(projectPath: string): Promise<TestSignals> {
  const testDirNames = ["tests", "test", "__tests__"];
  const testDirResults = await Promise.all(
    testDirNames.map((d) => isDir(join(projectPath, d)))
  );
  const hasTestDir = testDirResults.some(Boolean);

  // Check for *.test.* or *.spec.* files at root level
  let hasTestFiles = false;
  try {
    const rootEntries = await readdir(projectPath);
    hasTestFiles = rootEntries.some(
      (f) => /\.(test|spec)\.[^.]+$/.test(f)
    );
  } catch {
    // ignore
  }

  const [hasVitestConfig, hasJestConfig, hasPlaywrightConfig] = await Promise.all([
    (async () => {
      const entries = await readdir(projectPath).catch(() => [] as string[]);
      return entries.some((f) => f.startsWith("vitest.config."));
    })(),
    (async () => {
      const entries = await readdir(projectPath).catch(() => [] as string[]);
      return entries.some((f) => f.startsWith("jest.config."));
    })(),
    (async () => {
      const entries = await readdir(projectPath).catch(() => [] as string[]);
      return entries.some((f) => f.startsWith("playwright.config."));
    })(),
  ]);

  let testFramework: TestSignals["testFramework"] = undefined;
  if (hasVitestConfig) testFramework = "vitest";
  else if (hasJestConfig) testFramework = "jest";
  else if (hasPlaywrightConfig) testFramework = "playwright";

  return { hasTestDir, hasTestFiles, testFramework, hasVitestConfig, hasJestConfig, hasPlaywrightConfig };
}

async function collectWorkflowSignals(projectPath: string): Promise<WorkflowSignals> {
  const workflowsDir = join(projectPath, ".github", "workflows");
  if (!(await isDir(workflowsDir))) {
    return { hasCIWorkflows: false, workflowCount: 0 };
  }
  try {
    const entries = await readdir(workflowsDir);
    const ymlFiles = entries.filter((f) => f.endsWith(".yml") || f.endsWith(".yaml"));
    return { hasCIWorkflows: ymlFiles.length > 0, workflowCount: ymlFiles.length };
  } catch {
    return { hasCIWorkflows: false, workflowCount: 0 };
  }
}

async function collectContextSignals(projectPath: string): Promise<ContextSignals> {
  const hasTsConfig = await exists(join(projectPath, "tsconfig.json"));

  // ESLint config detection
  const eslintFiles = [
    ".eslintrc",
    ".eslintrc.js",
    ".eslintrc.cjs",
    ".eslintrc.yaml",
    ".eslintrc.yml",
    ".eslintrc.json",
    "eslint.config.js",
    "eslint.config.mjs",
    "eslint.config.cjs",
  ];
  const eslintResults = await Promise.all(
    eslintFiles.map((f) => exists(join(projectPath, f)))
  );
  const hasEslintConfig = eslintResults.some(Boolean);

  // Language and framework detection via package.json deps
  let detectedLanguage: ContextSignals["detectedLanguage"] = "unknown";
  let detectedFramework: ContextSignals["detectedFramework"] = undefined;

  if (hasTsConfig) {
    detectedLanguage = "typescript";
  }

  try {
    const raw = await readFile(join(projectPath, "package.json"), "utf-8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    const allDeps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
    };

    if ("typescript" in allDeps) detectedLanguage = "typescript";
    else if (detectedLanguage === "unknown") detectedLanguage = "javascript";

    // Shallow framework detection (order matters — more specific first)
    if ("next" in allDeps) detectedFramework = "next";
    else if ("remix" in allDeps || "@remix-run/react" in allDeps) detectedFramework = "remix";
    else if ("vite" in allDeps) detectedFramework = "vite";
    else if ("react" in allDeps) detectedFramework = "react";
  } catch {
    if (detectedLanguage === "unknown") detectedLanguage = "javascript";
  }

  return { hasTsConfig, detectedLanguage, detectedFramework, hasEslintConfig };
}

export async function collectEvidence(projectPath: string): Promise<RepoEvidence> {
  // Validate path exists and is a directory
  let pathStat: Awaited<ReturnType<typeof stat>>;
  try {
    pathStat = await stat(projectPath);
  } catch {
    process.stderr.write(`Error: path not found: ${projectPath}\n`);
    process.exit(2);
  }

  if (!pathStat.isDirectory()) {
    process.stderr.write(`Error: path is not a directory: ${projectPath}\n`);
    process.exit(2);
  }

  const [files, packages, tests, workflows, context] = await Promise.all([
    collectFileSignals(projectPath),
    parsePackageSignals(projectPath),
    collectTestSignals(projectPath),
    collectWorkflowSignals(projectPath),
    collectContextSignals(projectPath),
  ]);

  return { files, packages, tests, workflows, context };
}
