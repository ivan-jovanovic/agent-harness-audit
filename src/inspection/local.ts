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
import { collectPackageSignals, discoverPackageRoots } from "./package.js";

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

const E2E_OR_SMOKE_DIR_NAMES = ["e2e", "smoke", "e2e-tests", "smoke-tests"];
const E2E_OR_SMOKE_FILE_RE = /\.(e2e|smoke)\.[^.]+$/i;
const E2E_OR_SMOKE_CONFIG_FILES = [
  "playwright.config.js",
  "playwright.config.cjs",
  "playwright.config.mjs",
  "playwright.config.ts",
  "cypress.config.js",
  "cypress.config.cjs",
  "cypress.config.mjs",
  "cypress.config.ts",
  "cypress.json",
  "wdio.conf.js",
  "wdio.conf.cjs",
  "wdio.conf.mjs",
  "wdio.conf.ts",
  "webdriverio.conf.js",
  "webdriverio.conf.cjs",
  "webdriverio.conf.mjs",
  "webdriverio.conf.ts",
  "webdriver.conf.js",
  "webdriver.conf.cjs",
  "webdriver.conf.mjs",
  "webdriver.conf.ts",
  "nightwatch.conf.js",
  "nightwatch.conf.cjs",
  "nightwatch.conf.mjs",
  "nightwatch.conf.ts",
];
const E2E_OR_SMOKE_CONFIG_RE = /^(playwright|cypress|wdio|webdriverio|webdriver|nightwatch)(?:\.[^.]+)*\.(js|cjs|mjs|ts|json)$/i;
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

async function dirHasFiles(root: string): Promise<boolean> {
  try {
    const entries = await readdir(root, { withFileTypes: true });
    return entries.some((entry) => entry.isFile());
  } catch {
    return false;
  }
}

async function scanForE2eSmokeSignals(root: string, depth = 0, maxDepth = 4): Promise<boolean> {
  if (depth > maxDepth) return false;

  try {
    const entries = await readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(root, entry.name);
      if (entry.isFile()) {
        if (E2E_OR_SMOKE_FILE_RE.test(entry.name) || E2E_OR_SMOKE_CONFIG_RE.test(entry.name)) {
          return true;
        }
        continue;
      }

      if (!entry.isDirectory()) continue;
      if (IGNORED_DIR_NAMES.has(entry.name)) continue;
      if (E2E_OR_SMOKE_DIR_NAMES.includes(entry.name)) {
        if (await dirHasFiles(entryPath)) return true;
      }
      if (await scanForE2eSmokeSignals(entryPath, depth + 1, maxDepth)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

interface DocsTreeScan {
  markdownCount: number;
  hasNonEmptySubtree: boolean;
}

async function scanDocsTree(root: string): Promise<DocsTreeScan> {
  const entries = await readdir(root, { withFileTypes: true });
  let markdownCount = 0;
  let hasNonEmptySubtree = false;

  for (const entry of entries) {
    if (entry.isFile() && /\.(md|mdx|txt)$/i.test(entry.name)) {
      markdownCount += 1;
      continue;
    }

    if (entry.isDirectory()) {
      const child = await scanDocsTree(join(root, entry.name));
      markdownCount += child.markdownCount;
      if (child.markdownCount > 0 || child.hasNonEmptySubtree) {
        hasNonEmptySubtree = true;
      }
    }
  }

  return { markdownCount, hasNonEmptySubtree };
}

async function hasStructuredDocsDir(root: string): Promise<boolean> {
  try {
    const { markdownCount, hasNonEmptySubtree } = await scanDocsTree(root);
    return markdownCount >= 2 || (markdownCount >= 1 && hasNonEmptySubtree);
  } catch {
    return false;
  }
}

async function hasE2eOrSmokeTests(projectPath: string, hasPlaywrightConfig: boolean): Promise<boolean> {
  if (hasPlaywrightConfig) {
    return true;
  }

  try {
    const rootEntries = await readdir(projectPath, { withFileTypes: true });
    if (
      rootEntries.some(
        (entry) =>
          entry.isFile() &&
          (E2E_OR_SMOKE_FILE_RE.test(entry.name) ||
            E2E_OR_SMOKE_CONFIG_RE.test(entry.name) ||
            E2E_OR_SMOKE_CONFIG_FILES.includes(entry.name)),
      )
    ) {
      return true;
    }
  } catch {
    // ignore
  }

  const searchRoots = [projectPath, join(projectPath, "tests"), join(projectPath, "test"), join(projectPath, "__tests__")];

  for (const root of searchRoots) {
    if (await scanForE2eSmokeSignals(root)) {
      return true;
    }
  }

  return false;
}

const CI_VALIDATION_COMMAND_RE =
  /\b(?:npm|pnpm|yarn)\s+(?:run\s+)?(?:lint|test|typecheck|build)\b|\b(?:eslint|vitest|jest|playwright|tsc --noEmit|next lint)\b/i;

function hasValidationCommand(raw: string): boolean {
  return CI_VALIDATION_COMMAND_RE.test(raw);
}

async function collectGitHubWorkflowSignals(workflowsDir: string): Promise<WorkflowSignals> {
  try {
    const entries = await readdir(workflowsDir, { withFileTypes: true });
    const workflowFiles = entries.filter(
      (entry) => entry.isFile() && /\.(yml|yaml)$/i.test(entry.name),
    );

    let hasCIValidation = false;
    for (const file of workflowFiles) {
      const raw = await readFile(join(workflowsDir, file.name), "utf-8");
      if (hasValidationCommand(raw)) {
        hasCIValidation = true;
        break;
      }
    }

    return {
      hasCIPipeline: workflowFiles.length > 0,
      hasCIWorkflows: workflowFiles.length > 0,
      hasCIValidation,
      workflowCount: workflowFiles.length,
    };
  } catch {
    return {
      hasCIPipeline: false,
      hasCIWorkflows: false,
      hasCIValidation: false,
      workflowCount: 0,
    };
  }
}

async function collectGitLabCISignals(projectPath: string): Promise<WorkflowSignals> {
  const gitlabPath = join(projectPath, ".gitlab-ci.yml");
  if (!(await exists(gitlabPath))) {
    return {
      hasCIPipeline: false,
      hasCIWorkflows: false,
      hasCIValidation: false,
      workflowCount: 0,
    };
  }

  try {
    const raw = await readFile(gitlabPath, "utf-8");
    return {
      hasCIPipeline: true,
      hasCIWorkflows: true,
      hasCIValidation: hasValidationCommand(raw),
      workflowCount: 1,
    };
  } catch {
    return {
      hasCIPipeline: true,
      hasCIWorkflows: true,
      hasCIValidation: false,
      workflowCount: 1,
    };
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
    hasStructuredDocs,
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
    hasStructuredDocsDir(join(projectPath, "docs")),
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
    hasStructuredDocs,
  };
}

async function collectTestSignalsAtPath(projectPath: string): Promise<TestSignals> {
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

  const hasE2eOrSmoke = await hasE2eOrSmokeTests(projectPath, hasPlaywrightConfig);

  return {
    hasTestDir,
    hasTestFiles,
    hasE2eOrSmokeTests: hasE2eOrSmoke,
    testFramework,
    hasVitestConfig,
    hasJestConfig,
    hasPlaywrightConfig,
  };
}

async function collectTestSignals(projectPath: string, packageRoots: string[]): Promise<TestSignals> {
  const roots = [projectPath, ...packageRoots.filter((root) => root !== projectPath)];

  const aggregate: TestSignals = {
    hasTestDir: false,
    hasTestFiles: false,
    hasE2eOrSmokeTests: false,
    testFramework: undefined,
    hasVitestConfig: false,
    hasJestConfig: false,
    hasPlaywrightConfig: false,
  };

  for (const root of roots) {
    const signals = await collectTestSignalsAtPath(root);
    aggregate.hasTestDir = aggregate.hasTestDir || signals.hasTestDir;
    aggregate.hasTestFiles = aggregate.hasTestFiles || signals.hasTestFiles;
    aggregate.hasE2eOrSmokeTests = aggregate.hasE2eOrSmokeTests || signals.hasE2eOrSmokeTests;
    aggregate.hasVitestConfig = aggregate.hasVitestConfig || signals.hasVitestConfig;
    aggregate.hasJestConfig = aggregate.hasJestConfig || signals.hasJestConfig;
    aggregate.hasPlaywrightConfig = aggregate.hasPlaywrightConfig || signals.hasPlaywrightConfig;
    if (!aggregate.testFramework && signals.testFramework) {
      aggregate.testFramework = signals.testFramework;
    }
  }

  return aggregate;
}

async function collectWorkflowSignals(projectPath: string): Promise<WorkflowSignals> {
  const workflowsDir = join(projectPath, ".github", "workflows");
  try {
    const [githubSignals, gitlabSignals] = await Promise.all([
      (await isDir(workflowsDir))
        ? collectGitHubWorkflowSignals(workflowsDir)
        : Promise.resolve({
            hasCIPipeline: false,
            hasCIWorkflows: false,
            hasCIValidation: false,
            workflowCount: 0,
          }),
      collectGitLabCISignals(projectPath),
    ]);

    return {
      hasCIPipeline: githubSignals.hasCIPipeline || gitlabSignals.hasCIPipeline,
      hasCIWorkflows: githubSignals.hasCIWorkflows || gitlabSignals.hasCIWorkflows,
      hasCIValidation: githubSignals.hasCIValidation || gitlabSignals.hasCIValidation,
      workflowCount: githubSignals.workflowCount + gitlabSignals.workflowCount,
    };
  } catch {
    return {
      hasCIPipeline: false,
      hasCIWorkflows: false,
      hasCIValidation: false,
      workflowCount: 0,
    };
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

  const packageRoots = await discoverPackageRoots(projectPath);
  const [files, packages, tests, workflows, context] = await Promise.all([
    collectFileSignals(projectPath),
    collectPackageSignals(projectPath),
    collectTestSignals(projectPath, packageRoots),
    collectWorkflowSignals(projectPath),
    collectContextSignals(projectPath),
  ]);

  const warnings = [...packages.warnings];

  return { files, packages, tests, workflows, context, warnings };
}
