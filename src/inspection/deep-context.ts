import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";
import { discoverPackageRoots } from "./package.js";
import type { DeepAuditContext, DeepAuditExcerptSection, RepoEvidence } from "../types.js";

const MAX_ROOT_TREE_ENTRIES = 40;
const MAX_DOC_INDEX_CHARS = 4_000;
const MAX_TOP_LEVEL_DOC_NAMES = 24;
const MAX_PACKAGE_ROOTS = 4;
const MAX_SCRIPTS_PER_ROOT = 12;
const MAX_SCRIPT_LINE_CHARS = 140;
const MAX_WORKFLOW_NAMES = 12;
const MAX_SELECTED_DOCS = 2;
const MAX_SELECTED_DOC_CHARS = 3_500;
const MAX_SELECTED_DOC_DEPTH = 3;

const IGNORED_TREE_ENTRIES = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage",
  ".next",
  ".turbo",
  ".cache",
]);

const IGNORED_DOC_ENTRIES = new Set([".gitkeep", ".DS_Store"]);

const INSTRUCTION_DOC_CANDIDATES = ["AGENTS.md", "CLAUDE.md"];
const DOC_TEXT_EXT_RE = /\.(md|mdx|txt)$/i;

const DOCUMENTARY_DOC_RE =
  /^(architecture|system(?:[._-]?(?:design|architecture))?|repo(?:[._-]?(?:structure|map))?|codebase(?:[._-]?(?:guide|map))?|design|runbook|reliability|sre|ops|operations|production|incident|resilience|security|hardening|threat(?:[._-]?model)?|privacy|compliance)(?:[._-].+)?\.(md|mdx|txt)$/i;

function normalizeRelPath(value: string): string {
  return value.replaceAll("\\", "/");
}

function stableCompare(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function stripDocExtension(filename: string): string {
  return filename.replace(DOC_TEXT_EXT_RE, "");
}

function isPlanningDocStem(stem: string): boolean {
  const parts = stem.toLowerCase().split(/[._-]+/).filter(Boolean);
  return parts.includes("plan") || parts.includes("roadmap") || parts.includes("runbook");
}

function isPlansPath(relPath: string): boolean {
  const normalized = normalizeRelPath(relPath).toLowerCase();
  return normalized.startsWith("docs/plans/") || normalized.startsWith("plans/");
}

function isSelectedDocCandidate(relPath: string, filename: string): boolean {
  if (!DOC_TEXT_EXT_RE.test(filename)) {
    return false;
  }
  if (INSTRUCTION_DOC_CANDIDATES.includes(filename)) {
    return false;
  }

  if (isPlansPath(relPath)) {
    return true;
  }

  if (DOCUMENTARY_DOC_RE.test(filename)) {
    return true;
  }

  return isPlanningDocStem(stripDocExtension(filename));
}

function compareSelectedDocs(
  left: { path: string; rel: string },
  right: { path: string; rel: string },
): number {
  const leftRel = normalizeRelPath(left.rel);
  const rightRel = normalizeRelPath(right.rel);
  const leftStem = stripDocExtension(leftRel.split("/").at(-1) ?? leftRel);
  const rightStem = stripDocExtension(rightRel.split("/").at(-1) ?? rightRel);

  const priority = (rel: string, stem: string): number => {
    if (rel.toLowerCase().startsWith("docs/plans/")) return 0;
    if (rel.toLowerCase().startsWith("plans/")) return 1;
    if (isPlanningDocStem(stem)) return 2;
    return 3;
  };

  const priorityDiff = priority(leftRel, leftStem) - priority(rightRel, rightStem);
  if (priorityDiff !== 0) {
    return priorityDiff;
  }

  return stableCompare(leftRel, rightRel);
}

function truncateText(text: string, maxChars: number): { content: string; truncated: boolean } {
  if (text.length <= maxChars) {
    return { content: text, truncated: false };
  }

  return { content: text.slice(0, maxChars), truncated: true };
}

async function existsFile(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isFile();
  } catch {
    return false;
  }
}

async function existsDir(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

function renderSection(
  kind: DeepAuditExcerptSection["kind"],
  title: string,
  contentLines: string[],
  path?: string,
  truncated = false,
): DeepAuditExcerptSection {
  return {
    kind,
    title,
    path,
    content: contentLines.join("\n"),
    truncated,
  };
}

async function readBoundedFile(
  filePath: string,
  maxChars: number,
): Promise<{ content: string; truncated: boolean } | null> {
  try {
    const raw = await readFile(filePath, "utf-8");
    return truncateText(raw, maxChars);
  } catch {
    return null;
  }
}

async function collectRootTreeSection(projectPath: string): Promise<DeepAuditExcerptSection> {
  const entries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
  const lines = entries
    .filter((entry) => !IGNORED_TREE_ENTRIES.has(entry.name))
    .sort((a, b) => stableCompare(a.name, b.name))
    .slice(0, MAX_ROOT_TREE_ENTRIES)
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));

  const totalVisible = entries.filter((entry) => !IGNORED_TREE_ENTRIES.has(entry.name)).length;
  const truncated = totalVisible > lines.length;
  if (truncated) {
    const remaining = totalVisible - lines.length;
    lines.push(`... (+${remaining} more)`);
  }

  return renderSection("root-tree", "Root file tree summary", lines, projectPath, truncated);
}

async function collectInstructionSection(projectPath: string): Promise<DeepAuditExcerptSection | null> {
  for (const filename of INSTRUCTION_DOC_CANDIDATES) {
    const filePath = join(projectPath, filename);
    const bounded = await readBoundedFile(filePath, MAX_DOC_INDEX_CHARS);
    if (!bounded) continue;

    return {
      kind: "instructions",
      title: filename,
      path: filePath,
      content: bounded.content,
      truncated: bounded.truncated,
    };
  }

  return null;
}

async function collectDocsListing(projectPath: string): Promise<DeepAuditExcerptSection | null> {
  const docsDir = join(projectPath, "docs");
  if (!(await existsDir(docsDir))) {
    return null;
  }

  const indexCandidates = ["index.md", "README.md", "index.mdx", "README.mdx"];
  for (const filename of indexCandidates) {
    const filePath = join(docsDir, filename);
    const bounded = await readBoundedFile(filePath, MAX_DOC_INDEX_CHARS);
    if (!bounded) continue;

    return {
      kind: "docs-index",
      title: `docs/${filename}`,
      path: filePath,
      content: bounded.content,
      truncated: bounded.truncated,
    };
  }

  const entries = await readdir(docsDir, { withFileTypes: true }).catch(() => []);
  const names = entries
    .filter((entry) => !IGNORED_DOC_ENTRIES.has(entry.name))
    .sort((a, b) => stableCompare(a.name, b.name))
    .slice(0, MAX_TOP_LEVEL_DOC_NAMES)
    .map((entry) => (entry.isDirectory() ? `${entry.name}/` : entry.name));

  if (names.length === 0) {
    return null;
  }

  const totalVisible = entries.filter((entry) => !IGNORED_DOC_ENTRIES.has(entry.name)).length;
  const truncated = totalVisible > names.length;
  if (truncated) {
    const remaining = totalVisible - names.length;
    names.push(`... (+${remaining} more)`);
  }

  return renderSection("docs-listing", "Top-level docs listing", names, docsDir, truncated);
}

async function collectPackageScriptsSection(
  projectPath: string,
): Promise<DeepAuditExcerptSection | null> {
  const roots = await discoverPackageRoots(projectPath);
  if (roots.length === 0) return null;

  const orderedRoots = roots.slice().sort((a, b) => {
    const rootA = relative(projectPath, a) === "";
    const rootB = relative(projectPath, b) === "";
    if (rootA && !rootB) return -1;
    if (!rootA && rootB) return 1;
    return stableCompare(relative(projectPath, a), relative(projectPath, b));
  });

  const lines: string[] = [];
  let seenRoots = 0;

  for (const root of orderedRoots) {
    if (seenRoots >= MAX_PACKAGE_ROOTS) break;
    const packageJsonPath = join(root, "package.json");
    if (!(await existsFile(packageJsonPath))) continue;

    seenRoots += 1;
    const raw = await readFile(packageJsonPath, "utf-8").catch(() => null);
    if (raw === null) continue;

    try {
      const pkg = JSON.parse(raw) as { scripts?: Record<string, unknown> };
      const scripts = Object.entries(pkg.scripts ?? {})
        .flatMap(([name, value]) =>
          typeof value === "string" && value.trim().length > 0 ? ([[name, value.trim()]] as const) : [],
        )
        .sort(([a], [b]) => stableCompare(a, b))
        .slice(0, MAX_SCRIPTS_PER_ROOT);

      const rel = relative(projectPath, root) || ".";
      lines.push(`${rel}/package.json`);
      for (const [name, value] of scripts) {
        const line = `  ${name}: ${value}`;
        lines.push(line.length > MAX_SCRIPT_LINE_CHARS ? line.slice(0, MAX_SCRIPT_LINE_CHARS) : line);
      }
    } catch {
      lines.push(`${relative(projectPath, root) || "."}/package.json (unparseable)`);
    }
  }

  if (lines.length === 0) {
    return null;
  }

  return renderSection(
    "package-scripts",
    "Package scripts summary",
    lines,
    projectPath,
    roots.length > MAX_PACKAGE_ROOTS,
  );
}

async function collectWorkflowNamesSection(projectPath: string): Promise<DeepAuditExcerptSection | null> {
  const lines: string[] = [];
  let totalWorkflowNames = 0;

  const githubWorkflowsDir = join(projectPath, ".github", "workflows");
  if (await existsDir(githubWorkflowsDir)) {
    const entries = await readdir(githubWorkflowsDir, { withFileTypes: true }).catch(() => []);
    const workflowFiles = entries
      .filter((entry) => entry.isFile() && /\.(yml|yaml)$/i.test(entry.name))
      .map((entry) => entry.name)
      .sort(stableCompare);
    totalWorkflowNames += workflowFiles.length;
    for (const name of workflowFiles.slice(0, MAX_WORKFLOW_NAMES)) {
      lines.push(`.github/workflows/${name}`);
    }
  }

  const gitlabPath = join(projectPath, ".gitlab-ci.yml");
  const hasGitlab = await existsFile(gitlabPath);
  if (hasGitlab) {
    totalWorkflowNames += 1;
  }
  if (hasGitlab && lines.length < MAX_WORKFLOW_NAMES) {
    lines.push(".gitlab-ci.yml");
  }

  if (lines.length === 0) {
    return null;
  }

  return renderSection("workflows", "Workflow names", lines, projectPath, totalWorkflowNames > MAX_WORKFLOW_NAMES);
}

async function collectSelectedDocsSections(projectPath: string): Promise<DeepAuditExcerptSection[]> {
  const entries: Array<{ path: string; rel: string }> = [];
  const docsDir = join(projectPath, "docs");
  const plansDir = join(projectPath, "plans");

  if (await existsDir(projectPath)) {
    const rootEntries = await readdir(projectPath, { withFileTypes: true }).catch(() => []);
    for (const entry of rootEntries) {
      if (!entry.isFile()) continue;
      if (!isSelectedDocCandidate(entry.name, entry.name)) continue;
      entries.push({
        path: join(projectPath, entry.name),
        rel: entry.name,
      });
    }
  }

  async function scanDocsDir(currentDir: string, depth: number): Promise<void> {
    if (depth > MAX_SELECTED_DOC_DEPTH) return;

    const dirEntries = await readdir(currentDir, { withFileTypes: true }).catch(() => []);
    for (const entry of dirEntries) {
      const entryPath = join(currentDir, entry.name);
      if (entry.isFile()) {
        const relPath = normalizeRelPath(relative(projectPath, entryPath));
        if (!isSelectedDocCandidate(relPath, entry.name)) continue;
        entries.push({
          path: entryPath,
          rel: relPath,
        });
        continue;
      }

      if (!entry.isDirectory()) continue;
      if (IGNORED_DOC_ENTRIES.has(entry.name)) continue;
      await scanDocsDir(entryPath, depth + 1);
    }
  }

  if (await existsDir(docsDir)) {
    await scanDocsDir(docsDir, 0);
  }
  if (await existsDir(plansDir)) {
    await scanDocsDir(plansDir, 0);
  }

  const unique = new Map<string, { path: string; rel: string }>();
  for (const entry of entries.sort(compareSelectedDocs)) {
    unique.set(entry.rel, entry);
  }

  const sections: DeepAuditExcerptSection[] = [];
  for (const { path, rel } of unique.values()) {
    if (sections.length >= MAX_SELECTED_DOCS) break;
    const bounded = await readBoundedFile(path, MAX_SELECTED_DOC_CHARS);
    if (!bounded) continue;

    sections.push({
      kind: "architecture-doc",
      title: rel,
      path,
      content: bounded.content,
      truncated: bounded.truncated,
    });
  }

  return sections;
}

export async function collectDeepAuditContext(
  projectPath: string,
  _evidence: RepoEvidence,
): Promise<DeepAuditContext> {
  void _evidence;
  const sections: DeepAuditExcerptSection[] = [];

  sections.push(await collectRootTreeSection(projectPath));

  const instructionSection = await collectInstructionSection(projectPath);
  if (instructionSection) {
    sections.push(instructionSection);
  }

  const docsSection = await collectDocsListing(projectPath);
  if (docsSection) {
    sections.push(docsSection);
  }

  const packageScriptsSection = await collectPackageScriptsSection(projectPath);
  if (packageScriptsSection) {
    sections.push(packageScriptsSection);
  }

  const workflowSection = await collectWorkflowNamesSection(projectPath);
  if (workflowSection) {
    sections.push(workflowSection);
  }

  const selectedDocs = await collectSelectedDocsSections(projectPath);
  sections.push(...selectedDocs);

  return { sections };
}
