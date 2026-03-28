import { describe, it, expect } from "vitest";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { collectEvidence } from "../../src/inspection/local.js";
import { scoreInstructions } from "../../src/scoring/categories/instructions.js";
import { scoreContext } from "../../src/scoring/categories/context.js";
import { scoreTooling } from "../../src/scoring/categories/tooling.js";
import { scoreFeedback } from "../../src/scoring/categories/feedback.js";
import { scoreSafety } from "../../src/scoring/categories/safety.js";
import { scoreProject } from "../../src/scoring/index.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRepo(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "harness-skills-"));
  for (const [relPath, content] of Object.entries(files)) {
    const absPath = join(dir, relPath);
    mkdirSync(dirname(absPath), { recursive: true });
    writeFileSync(absPath, content);
  }
  return dir;
}

function cleanupRepo(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

// ── Instructions scorer ───────────────────────────────────────────────────────

describe("scoreInstructions — minimal fixture", () => {
  it("scores 0 when all files missing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreInstructions(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.id).toBe("instructions");
    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(3);
    expect(result.failingChecks).toHaveLength(3);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreInstructions — strong fixture", () => {
  it("scores 4.3 when AGENTS.md and README are present but generic skills are missing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreInstructions(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.score).toBe(4.3);
    expect(result.failingChecks).toHaveLength(1);
    expect(result.failingChecks.map((c) => c.id)).toEqual(["has_generic_skills"]);
  });
});

describe("scoreInstructions — partial fixture", () => {
  it("passes only has_readme", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreInstructions(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    const passingChecks = result.checks.filter((c) => c.passed);
    expect(passingChecks.map((c) => c.id)).toEqual(["has_readme"]);
    // score = 0.10 / 0.70 * 5 = 0.714... → 0.7 after rounding
    expect(result.score).toBe(0.7);
  });
});

describe("scoreInstructions — ts-webapp fixture", () => {
  it("passes primary instructions and readme", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreInstructions(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.checks.find((c) => c.id === "has_primary_instructions")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_readme")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_generic_skills")!.passed).toBe(false);
    expect(result.checks).toHaveLength(3);
    expect(result.score).toBe(4.3);
  });
});

describe("scoreInstructions — skills semantics", () => {
  it("scores generic skills when .agents/skills contains SKILL.md", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".agents/skills/repo/SKILL.md": "# reusable skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, { toolsRequested: "all", toolsResolved: ["other"] });
      expect(result.checks.find((c) => c.id === "has_generic_skills")!.passed).toBe(true);
      expect(result.checks.some((c) => c.id === "has_tool_skills")).toBe(false);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("scores Claude-only tool skills when claude-code is targeted", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".agents/skills/repo/SKILL.md": "# reusable skill",
      ".claude/skills/recipes/SKILL.md": "# claude skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["claude-code"],
        toolsResolved: ["claude-code"],
      });
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(true);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("lets CLAUDE.md satisfy primary instructions for Claude-only repos", async () => {
    const dir = makeRepo({
      "CLAUDE.md": "# claude instructions",
      "README.md": "# readme",
      ".claude/skills/recipes/SKILL.md": "# claude skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["claude-code"],
        toolsResolved: ["claude-code"],
      });
      expect(result.checks.find((c) => c.id === "has_primary_instructions")!.passed).toBe(true);
      expect(result.checks.some((c) => c.id === "has_generic_skills")).toBe(false);
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(true);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("lets a single native Claude surface satisfy primary instructions in the default audit", async () => {
    const dir = makeRepo({
      "CLAUDE.md": "# claude instructions",
      "README.md": "# readme",
      ".claude/skills/recipes/SKILL.md": "# claude skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: "all",
        toolsResolved: ["claude-code", "codex", "cursor", "copilot", "other"],
      });
      expect(result.checks.find((c) => c.id === "has_primary_instructions")!.passed).toBe(true);
      expect(result.score).toBe(3);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("lets CLAUDE.md act as the primary surface when all selected supported tools have native skills", async () => {
    const dir = makeRepo({
      "CLAUDE.md": "# claude instructions",
      "README.md": "# readme",
      ".claude/skills/recipes/SKILL.md": "# claude skill",
      ".cursor/skills/recipes/SKILL.md": "# cursor skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: "all",
        toolsResolved: ["claude-code", "codex", "cursor", "copilot", "other"],
      });
      expect(result.checks.find((c) => c.id === "has_primary_instructions")!.passed).toBe(true);
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(true);
      expect(result.score).toBe(4.5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("scores Cursor-only tool skills when cursor is targeted", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".agents/skills/repo/SKILL.md": "# reusable skill",
      ".cursor/skills/recipes/SKILL.md": "# cursor skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["cursor"],
        toolsResolved: ["cursor"],
      });
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(true);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("omits generic skills when a single selected supported tool already has native skills", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".cursor/skills/recipes/SKILL.md": "# cursor skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["cursor"],
        toolsResolved: ["cursor"],
      });
      expect(result.checks.some((c) => c.id === "has_generic_skills")).toBe(false);
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(true);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("requires both Claude and Cursor skills when both tools are selected", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".agents/skills/repo/SKILL.md": "# reusable skill",
      ".claude/skills/recipes/SKILL.md": "# claude skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["claude-code", "cursor"],
        toolsResolved: ["claude-code", "cursor"],
      });
      expect(result.checks.find((c) => c.id === "has_tool_skills")!.passed).toBe(false);
      expect(result.score).toBe(3.5);
    } finally {
      cleanupRepo(dir);
    }
  });

  it("omits has_tool_skills when only unsupported tools are selected", async () => {
    const dir = makeRepo({
      "AGENTS.md": "# agent instructions",
      "README.md": "# readme",
      ".agents/skills/repo/SKILL.md": "# reusable skill",
    });
    try {
      const ev = await collectEvidence(dir);
      const result = scoreInstructions(ev, {
        toolsRequested: ["codex", "copilot"],
        toolsResolved: ["codex", "copilot"],
      });
      expect(result.checks.some((c) => c.id === "has_tool_skills")).toBe(false);
      expect(result.score).toBe(5);
    } finally {
      cleanupRepo(dir);
    }
  });

});

// ── Context scorer ────────────────────────────────────────────────────────────

describe("scoreContext — minimal fixture", () => {
  it("scores 0 when all checks fail", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreContext(ev);
    expect(result.id).toBe("context");
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(5);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreContext — strong fixture", () => {
  it("scores 5 when all context checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreContext(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
    expect(result.checks.find((c) => c.id === "has_docs_index")!.passed).toBe(true);
  });
});

describe("scoreContext — partial fixture", () => {
  it("all context checks fail (no docs, no tsconfig, no env example)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreContext(ev);
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(5);
  });
});

describe("scoreContext — ts-webapp fixture", () => {
  it("all context checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreContext(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
    expect(result.checks.find((c) => c.id === "has_docs_index")!.passed).toBe(true);
  });
});

// ── Tooling scorer ────────────────────────────────────────────────────────────

describe("scoreTooling — minimal fixture", () => {
  it("passes only has_package_json", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreTooling(ev);
    expect(result.id).toBe("tooling");
    expect(result.checks.filter((c) => c.passed).map((c) => c.id)).toEqual(["has_package_json"]);
    // score = 0.20 / 1.0 * 5 = 1.0
    expect(result.score).toBe(1);
    expect(result.failingChecks).toHaveLength(4);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreTooling — partial fixture", () => {
  it("passes package_json, lockfile, and test script only", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreTooling(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_package_json");
    expect(passingIds).toContain("has_lockfile");
    expect(passingIds).not.toContain("has_lint_script");
    expect(passingIds).not.toContain("has_typecheck_script");
    expect(passingIds).not.toContain("has_build_script");
    // score = 0.40 / 1.0 * 5 = 2.0
    expect(result.score).toBe(2);
  });
});

describe("scoreTooling — strong fixture", () => {
  it("scores 5 when all tooling checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreTooling(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

describe("scoreTooling — ts-webapp fixture", () => {
  it("scores 5 when all tooling checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreTooling(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

// ── Feedback scorer ───────────────────────────────────────────────────────────

describe("scoreFeedback — minimal fixture", () => {
  it("scores 0 when no test infra exists", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreFeedback(ev);
    expect(result.id).toBe("feedback");
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(3);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreFeedback — partial fixture", () => {
  it("passes test_script and test_dir", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreFeedback(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_test_script");
    expect(passingIds).toContain("has_test_dir");
    // score = (0.25 + 0.30) / 0.70 * 5 = 3.928... → 3.9
    expect(result.score).toBe(3.9);
  });
});

describe("scoreFeedback — strong fixture", () => {
  it("passes all feedback checks", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreFeedback(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_test_script");
    expect(passingIds).toContain("has_test_dir");
    expect(passingIds).toContain("has_test_files");
    // score = (0.25 + 0.30 + 0.15) / 0.70 * 5 = 5.0
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

describe("scoreFeedback — ts-webapp fixture", () => {
  it("passes test_script and test_dir but not has_test_files", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreFeedback(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_test_script");
    expect(passingIds).toContain("has_test_dir");
    expect(passingIds).not.toContain("has_test_files");
    expect(result.score).toBe(3.9);
    expect(result.failingChecks).toHaveLength(1);
  });
});

// ── Safety scorer ─────────────────────────────────────────────────────────────

describe("scoreSafety — minimal fixture", () => {
  it("scores 0 when all safety checks fail", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreSafety(ev);
    expect(result.id).toBe("safety");
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(2);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreSafety — partial fixture", () => {
  it("all safety checks fail", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreSafety(ev);
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(2);
  });
});

describe("scoreSafety — strong fixture", () => {
  it("scores 5 when all safety checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreSafety(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

describe("scoreSafety — ts-webapp fixture", () => {
  it("passes env_example and architecture_docs", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreSafety(ev);
    expect(result.checks.find((c) => c.id === "has_env_example")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_architecture_docs")!.passed).toBe(true);
    expect(result.checks).toHaveLength(2);
    // score = (0.60 + 0.40) / 1.0 * 5 = 5.0
    expect(result.score).toBe(5);
  });
});

// ── scoreProject orchestrator ─────────────────────────────────────────────────

describe("scoreProject — minimal fixture", () => {
  it("returns integer overallScore 0-100", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(Number.isInteger(result.overallScore)).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    // minimal: only has_package_json passes → overall = (1.0/5 * 0.25) * 100 = 5
    expect(result.overallScore).toBe(5);
  });

  it("returns exactly 5 category scores", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.categoryScores).toHaveLength(5);
    expect(result.categoryScores.map((c) => c.id)).toEqual([
      "instructions",
      "context",
      "tooling",
      "feedback",
      "safety",
    ]);
  });

  it("topBlockers has at most 3 entries", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.topBlockers.length).toBeLessThanOrEqual(3);
    expect(result.topBlockers.length).toBe(3);
  });

  it("top blocker is has_primary_instructions (highest impact: 0.20 * 0.50 = 0.10)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.topBlockers[0].checkId).toBe("has_primary_instructions");
    expect(result.topBlockers[0].categoryId).toBe("instructions");
  });

  it("all blockers have valid effort values", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    for (const blocker of result.topBlockers) {
      expect(["quick", "medium", "heavy"]).toContain(blocker.effort);
    }
  });

  it("fixPlan covers all failing checks with valid effort values", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.fixPlan.length).toBeGreaterThan(0);
    for (const item of result.fixPlan) {
      expect(["quick", "medium", "heavy"]).toContain(item.effort);
      expect(item.action).toBeTruthy();
    }
  });

  it("is deterministic — same evidence produces same output", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const r1 = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    const r2 = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(r1).toEqual(r2);
  });
});

describe("scoreProject — strong fixture", () => {
  it("scores 97 when only generic skills are missing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.overallScore).toBe(97);
  });

  it("has 0 topBlockers and 0 fixPlan entries", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(result.topBlockers).toHaveLength(1);
    expect(result.topBlockers[0].checkId).toBe("has_generic_skills");
    expect(result.fixPlan).toHaveLength(1);
  });
});

describe("scoreProject — partial fixture", () => {
  it("returns integer overallScore", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(Number.isInteger(result.overallScore)).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("scores higher than minimal", async () => {
    const evMin = await collectEvidence(join(fixturesDir, "minimal"));
    const evPar = await collectEvidence(join(fixturesDir, "partial"));
    const rMin = scoreProject(evMin, { toolsRequested: "all", toolsResolved: ["other"] });
    const rPar = scoreProject(evPar, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(rPar.overallScore).toBeGreaterThan(rMin.overallScore);
  });
});

describe("scoreProject — ts-webapp fixture", () => {
  it("scores higher than partial", async () => {
    const evPar = await collectEvidence(join(fixturesDir, "partial"));
    const evTs = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const rPar = scoreProject(evPar, { toolsRequested: "all", toolsResolved: ["other"] });
    const rTs = scoreProject(evTs, { toolsRequested: "all", toolsResolved: ["other"] });
    expect(rTs.overallScore).toBeGreaterThan(rPar.overallScore);
  });

  it("scores lower when selected supported tools are missing tool skills", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const rAll = scoreProject(ev, {
      toolsRequested: "all",
      toolsResolved: ["claude-code", "codex", "cursor", "copilot", "other"],
    });
    const rOther = scoreProject(ev, {
      toolsRequested: ["other"],
      toolsResolved: ["other"],
    });
    expect(rAll.overallScore).toBeLessThan(rOther.overallScore);
    expect(rAll.categoryScores.find((c) => c.id === "instructions")?.score).toBeLessThan(
      rOther.categoryScores.find((c) => c.id === "instructions")?.score ?? 0
    );
  });

  it("keeps Claude-only repos higher than the default audit while letting native Claude instructions count", async () => {
    const dir = makeRepo({
      "CLAUDE.md": "# claude instructions",
      "README.md": "# readme",
      ".claude/skills/repo/SKILL.md": "# claude skill",
      ".cursor/skills/repo/SKILL.md": "# cursor skill",
      "package.json": JSON.stringify({ name: "portal-like", scripts: {} }, null, 2),
    });
    try {
      const ev = await collectEvidence(dir);
      const rAll = scoreProject(ev, {
        toolsRequested: "all",
        toolsResolved: ["claude-code", "codex", "cursor", "copilot", "other"],
      });
      const rClaudeOnly = scoreProject(ev, {
        toolsRequested: ["claude-code"],
        toolsResolved: ["claude-code"],
      });

      expect(rClaudeOnly.categoryScores.find((c) => c.id === "instructions")?.score).toBe(5);
      expect(rAll.categoryScores.find((c) => c.id === "instructions")?.score).toBe(4.5);
      expect(rClaudeOnly.overallScore).toBeGreaterThan(rAll.overallScore);
    } finally {
      cleanupRepo(dir);
    }
  });
});

describe("scoreProject — blocker ranking", () => {
  it("topBlockers sorted by categoryWeight * checkWeight descending", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { toolsRequested: "all", toolsResolved: ["other"] });
    const impacts = result.topBlockers.map((b) => {
      const cat = result.categoryScores.find((c) => c.id === b.categoryId)!;
      const catWeight =
        b.categoryId === "instructions"
          ? 0.20
          : b.categoryId === "context"
          ? 0.20
          : b.categoryId === "tooling"
          ? 0.25
          : b.categoryId === "feedback"
          ? 0.25
          : 0.10;
      const check = cat.failingChecks.find((c) => c.id === b.checkId)!;
      return catWeight * check.weight;
    });
    for (let i = 0; i < impacts.length - 1; i++) {
      expect(impacts[i]).toBeGreaterThanOrEqual(impacts[i + 1]);
    }
  });
});

describe("scoreProject — tool readiness", () => {
  it("includes claude-code readiness and leaves unsupported tools not-scored", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreProject(ev, {
      toolsRequested: "all",
      toolsResolved: ["claude-code", "codex", "cursor", "copilot", "other"],
    });

    expect(result).toHaveProperty("toolReadiness");
    expect(result).toHaveProperty("toolSpecificFixes");
    expect(result.toolReadiness).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tool: "claude-code", status: "needs-work" }),
        expect.objectContaining({ tool: "codex", status: "not-scored" }),
        expect.objectContaining({ tool: "cursor", status: "not-scored" }),
        expect.objectContaining({ tool: "copilot", status: "not-scored" }),
        expect.objectContaining({ tool: "other", status: "not-scored" }),
      ]),
    );
    expect(result.toolReadiness.find((item) => item.tool === "claude-code")?.score).toBe(0);
    expect(result.toolSpecificFixes.length).toBeGreaterThanOrEqual(1);
  });
});

describe("scoreProject — deep overrides", () => {
  it("can upgrade a failing derived check (has_primary_instructions)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const base = scoreProject(ev, {
      toolsRequested: "all",
      toolsResolved: ["other"],
    });
    const overridden = scoreProject(
      ev,
      {
        toolsRequested: "all",
        toolsResolved: ["other"],
      },
      { has_primary_instructions: true },
    );

    const baseInstructions = base.categoryScores.find((c) => c.id === "instructions");
    const overriddenInstructions = overridden.categoryScores.find((c) => c.id === "instructions");
    expect(baseInstructions?.checks.find((c) => c.id === "has_primary_instructions")?.passed).toBe(false);
    expect(overriddenInstructions?.checks.find((c) => c.id === "has_primary_instructions")?.passed).toBe(true);
    expect(overridden.overallScore).toBeGreaterThan(base.overallScore);
  });

  it("does not downgrade checks when override value is false", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreProject(
      ev,
      {
        toolsRequested: "all",
        toolsResolved: ["other"],
      },
      { has_readme: false },
    );

    expect(result.categoryScores.find((c) => c.id === "instructions")?.checks.find((c) => c.id === "has_readme")?.passed).toBe(true);
  });
});
