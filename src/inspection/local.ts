import { readdir, stat, readFile } from "fs/promises";
import { join } from "path";
import type {
  RepoEvidence,
  FileSignals,
  TestSignals,
  WorkflowSignals,
  ContextSignals,
} from "../types.js";
import { AuditUsageError } from "../types.js";
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

async function hasSkillFile(root: string): Promise<boolean> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(root, entry.name);
      if (entry.isFile() && entry.name === "SKILL.md") {
        return true;
      }
      if (entry.isDirectory() && (await hasSkillFile(fullPath))) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const ARCHITECTURE_DOC_RE =
  /^(architecture|system(?:-design|-architecture)?|repo-(?:structure|map)|codebase-(?:guide|map)|structure|design)(?:[._-].+)?\.(md|mdx|txt)$/i;

async function hasArchitectureDoc(root: string): Promise<boolean> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.some((entry) => entry.isFile() && ARCHITECTURE_DOC_RE.test(entry.name));
  } catch {
    return false;
  }
}

async function hasDocsIndexFile(root: string): Promise<boolean> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.some(
      (entry) =>
        entry.isFile() &&
        /^(index|README)\.(md|mdx|txt)$/i.test(entry.name),
    );
  } catch {
    return false;
  }
}

async function collectFileSignals(projectPath: string): Promise<FileSignals> {
  const [
    hasAgentsMd,
    hasCLAUDEMd,
    hasReadme,
    hasGenericSkills,
    hasClaudeSkills,
    hasCursorSkills,
    hasEnvExample,
    hasDocsDir,
    hasDocsIndex,
    hasRootArchitectureDoc,
    hasDocsArchitectureDoc,
  ] = await Promise.all([
    exists(join(projectPath, "AGENTS.md")),
    exists(join(projectPath, "CLAUDE.md")),
    (async () =>
      (await exists(join(projectPath, "README.md"))) ||
      (await exists(join(projectPath, "README"))))(),
    hasSkillFile(join(projectPath, ".agents", "skills")),
    hasSkillFile(join(projectPath, ".claude", "skills")),
    hasSkillFile(join(projectPath, ".cursor", "skills")),
    exists(join(projectPath, ".env.example")),
    isDir(join(projectPath, "docs")),
    hasDocsIndexFile(join(projectPath, "docs")),
    hasArchitectureDoc(projectPath),
    hasArchitectureDoc(join(projectPath, "docs")),
  ]);

  const hasArchitectureDocs = hasRootArchitectureDoc || hasDocsArchitectureDoc;

  return {
    hasAgentsMd,
    hasCLAUDEMd,
    hasReadme,
    hasGenericSkills,
    hasClaudeSkills,
    hasCursorSkills,
    hasArchitectureDocs,
    hasEnvExample,
    hasDocsDir,
    hasDocsIndex,
  };
}

async function collectTestSignals(projectPath: string): Promise<TestSignals> {
  const testDirNames = ["tests", "test", "__tests__"];
  const testDirResults = await Promise.all(
    testDirNames.map((d) => isDir(join(projectPath, d)))
  );
  const hasTestDir = testDirResults.some(Boolean);

  // Check for *.test.* or *.spec.* files at root level and one level into test directories
  const TEST_FILE_RE = /\.(test|spec)\.[^.]+$/;
  let hasTestFiles = false;
  try {
    const rootEntries = await readdir(projectPath);
    hasTestFiles = rootEntries.some((f) => TEST_FILE_RE.test(f));
  } catch {
    // ignore
  }
  if (!hasTestFiles) {
    for (const dirName of testDirNames) {
      try {
        const entries = await readdir(join(projectPath, dirName));
        if (entries.some((f) => TEST_FILE_RE.test(f))) {
          hasTestFiles = true;
          break;
        }
      } catch {
        // directory doesn't exist or can't be read
      }
    }
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
    throw new AuditUsageError(`path not found: ${projectPath}`);
  }

  if (!pathStat.isDirectory()) {
    throw new AuditUsageError(`path is not a directory: ${projectPath}`);
  }

  const [files, packages, tests, workflows, context] = await Promise.all([
    collectFileSignals(projectPath),
    parsePackageSignals(projectPath),
    collectTestSignals(projectPath),
    collectWorkflowSignals(projectPath),
    collectContextSignals(projectPath),
  ]);

  const warnings = [...packages.warnings];

  return { files, packages, tests, workflows, context, warnings };
}
