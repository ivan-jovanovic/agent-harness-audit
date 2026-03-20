import { describe, it, expect } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { collectEvidence } from "../../src/inspection/local.js";
import { scoreInstructions } from "../../src/scoring/categories/instructions.js";
import { scoreContext } from "../../src/scoring/categories/context.js";
import { scoreTooling } from "../../src/scoring/categories/tooling.js";
import { scoreFeedback } from "../../src/scoring/categories/feedback.js";
import { scoreSafety } from "../../src/scoring/categories/safety.js";
import { scoreProject } from "../../src/scoring/index.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

// ── Helpers ───────────────────────────────────────────────────────────────────

function expectScore(score: number) {
  expect(Number.isInteger(score * 10)).toBe(true); // one decimal place
  expect(score).toBeGreaterThanOrEqual(0);
  expect(score).toBeLessThanOrEqual(5);
}

// ── Instructions scorer ───────────────────────────────────────────────────────

describe("scoreInstructions — minimal fixture", () => {
  it("scores 0 when all files missing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreInstructions(ev, { tool: "other" });
    expect(result.id).toBe("instructions");
    expect(result.score).toBe(0);
    expect(result.checks).toHaveLength(4);
    expect(result.failingChecks).toHaveLength(4);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });

  it("applies claude-code boost to has_claude_md weight and zeros has_contributing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreInstructions(ev, { tool: "claude-code" });
    const claudeCheck = result.checks.find((c) => c.id === "has_claude_md")!;
    const contributingCheck = result.checks.find((c) => c.id === "has_contributing")!;
    expect(claudeCheck.weight).toBe(0.40);
    expect(contributingCheck.weight).toBe(0.00);
  });
});

describe("scoreInstructions — strong fixture", () => {
  it("scores 5 when all files present", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreInstructions(ev, { tool: "other" });
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });

  it("scores 5 with claude-code tool when all files present", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreInstructions(ev, { tool: "claude-code" });
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

describe("scoreInstructions — partial fixture", () => {
  it("passes only has_readme", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreInstructions(ev, { tool: "other" });
    const passingChecks = result.checks.filter((c) => c.passed);
    expect(passingChecks.map((c) => c.id)).toEqual(["has_readme"]);
    // score = 0.25 / 1.0 * 5 = 1.25 → Math.round(1.25 * 10) / 10
    expect(result.score).toBe(1.3); // Math.round(12.5) = 13 → 1.3
  });
});

describe("scoreInstructions — ts-webapp fixture", () => {
  it("passes agents_md and readme but not claude_md or contributing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreInstructions(ev, { tool: "other" });
    expect(result.checks.find((c) => c.id === "has_agents_md")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_readme")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_claude_md")!.passed).toBe(false);
    expect(result.checks.find((c) => c.id === "has_contributing")!.passed).toBe(false);
    expectScore(result.score);
  });
});

// ── Context scorer ────────────────────────────────────────────────────────────

describe("scoreContext — minimal fixture", () => {
  it("scores 0 when all checks fail", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreContext(ev);
    expect(result.id).toBe("context");
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(4);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreContext — strong fixture", () => {
  it("scores 5 when all context checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreContext(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
  });
});

describe("scoreContext — partial fixture", () => {
  it("all context checks fail (no docs, no tsconfig, no env example)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreContext(ev);
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(4);
  });
});

describe("scoreContext — ts-webapp fixture", () => {
  it("all context checks pass", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreContext(ev);
    expect(result.score).toBe(5);
    expect(result.failingChecks).toHaveLength(0);
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
    expect(result.failingChecks).toHaveLength(4);
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
    expect(passingIds).not.toContain("has_ci_workflows");
    // score = (0.25 + 0.30) / 1.0 * 5 = 2.75
    expect(result.score).toBe(2.8); // Math.round(27.5) = 28 → 2.8
  });
});

describe("scoreFeedback — strong fixture", () => {
  it("passes test_script, test_dir, and ci_workflows but not has_test_files (no root-level *.test.* files)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreFeedback(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_test_script");
    expect(passingIds).toContain("has_test_dir");
    expect(passingIds).toContain("has_ci_workflows");
    expect(passingIds).not.toContain("has_test_files");
    // score = (0.25 + 0.30 + 0.30) / 1.0 * 5 = 0.85 * 5 = 4.25 → Math.round(42.5) = 43 → 4.3
    expect(result.score).toBe(4.3);
    expect(result.failingChecks).toHaveLength(1);
    expect(result.failingChecks[0].id).toBe("has_test_files");
    expect(result.failingChecks[0].failureNote).toBeTruthy();
  });
});

describe("scoreFeedback — ts-webapp fixture", () => {
  it("passes test_script, test_dir, and ci_workflows but not has_test_files", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreFeedback(ev);
    const passingIds = result.checks.filter((c) => c.passed).map((c) => c.id);
    expect(passingIds).toContain("has_test_script");
    expect(passingIds).toContain("has_test_dir");
    expect(passingIds).toContain("has_ci_workflows");
    expect(passingIds).not.toContain("has_test_files");
    expect(result.score).toBe(4.3);
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
    expect(result.failingChecks).toHaveLength(3);
    expect(result.failingChecks.every((c) => c.failureNote)).toBe(true);
  });
});

describe("scoreSafety — partial fixture", () => {
  it("all safety checks fail", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreSafety(ev);
    expect(result.score).toBe(0);
    expect(result.failingChecks).toHaveLength(3);
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
  it("passes env_example and architecture_docs but not contributing", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const result = scoreSafety(ev);
    expect(result.checks.find((c) => c.id === "has_env_example")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_architecture_docs")!.passed).toBe(true);
    expect(result.checks.find((c) => c.id === "has_contributing")!.passed).toBe(false);
    // score = (0.40 + 0.30) / 1.0 * 5 = 3.5
    expect(result.score).toBe(3.5);
  });
});

// ── scoreProject orchestrator ─────────────────────────────────────────────────

describe("scoreProject — minimal fixture", () => {
  it("returns integer overallScore 0-100", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
    expect(Number.isInteger(result.overallScore)).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
    // minimal: only has_package_json passes → overall = (1.0/5 * 0.20) * 100 = 4
    expect(result.overallScore).toBe(4);
  });

  it("returns exactly 5 category scores", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
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
    const result = scoreProject(ev, { tool: "other" });
    expect(result.topBlockers.length).toBeLessThanOrEqual(3);
    expect(result.topBlockers.length).toBe(3);
  });

  it("top blocker is has_agents_md (highest impact: 0.25 * 0.35 = 0.0875)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
    expect(result.topBlockers[0].checkId).toBe("has_agents_md");
    expect(result.topBlockers[0].categoryId).toBe("instructions");
  });

  it("all blockers have valid effort values", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
    for (const blocker of result.topBlockers) {
      expect(["quick", "medium", "heavy"]).toContain(blocker.effort);
    }
  });

  it("fixPlan covers all failing checks with valid effort values", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
    expect(result.fixPlan.length).toBeGreaterThan(0);
    for (const item of result.fixPlan) {
      expect(["quick", "medium", "heavy"]).toContain(item.effort);
      expect(item.action).toBeTruthy();
    }
  });

  it("is deterministic — same evidence produces same output", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const r1 = scoreProject(ev, { tool: "other" });
    const r2 = scoreProject(ev, { tool: "other" });
    expect(r1).toEqual(r2);
  });
});

describe("scoreProject — strong fixture", () => {
  it("scores 97 (has_test_files not present at root drops feedback slightly)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreProject(ev, { tool: "other" });
    // feedback score is 4.3 (not 5) because has_test_files checks root-level *.test.* files
    // overall = (5/5*0.25 + 5/5*0.20 + 5/5*0.20 + 4.3/5*0.25 + 5/5*0.10) * 100 = 96.5 → 97
    expect(result.overallScore).toBe(97);
  });

  it("has 1 topBlocker (has_test_files) and 1 fixPlan entry", async () => {
    const ev = await collectEvidence(join(fixturesDir, "strong"));
    const result = scoreProject(ev, { tool: "other" });
    expect(result.topBlockers).toHaveLength(1);
    expect(result.topBlockers[0].checkId).toBe("has_test_files");
    expect(result.fixPlan).toHaveLength(1);
    expect(result.fixPlan[0].checkId).toBe("has_test_files");
    expect(result.fixPlan[0].effort).toBe("medium");
  });
});

describe("scoreProject — partial fixture", () => {
  it("returns integer overallScore", async () => {
    const ev = await collectEvidence(join(fixturesDir, "partial"));
    const result = scoreProject(ev, { tool: "other" });
    expect(Number.isInteger(result.overallScore)).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.overallScore).toBeLessThanOrEqual(100);
  });

  it("scores higher than minimal", async () => {
    const evMin = await collectEvidence(join(fixturesDir, "minimal"));
    const evPar = await collectEvidence(join(fixturesDir, "partial"));
    const rMin = scoreProject(evMin, { tool: "other" });
    const rPar = scoreProject(evPar, { tool: "other" });
    expect(rPar.overallScore).toBeGreaterThan(rMin.overallScore);
  });
});

describe("scoreProject — ts-webapp fixture", () => {
  it("scores higher than partial", async () => {
    const evPar = await collectEvidence(join(fixturesDir, "partial"));
    const evTs = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const rPar = scoreProject(evPar, { tool: "other" });
    const rTs = scoreProject(evTs, { tool: "other" });
    expect(rTs.overallScore).toBeGreaterThan(rPar.overallScore);
  });

  it("claude-code tool changes instructions check weights (claude_md boosted, contributing zeroed)", async () => {
    const ev = await collectEvidence(join(fixturesDir, "ts-webapp"));
    const rOther = scoreProject(ev, { tool: "other" });
    const rClaude = scoreProject(ev, { tool: "claude-code" });
    const instrOther = rOther.categoryScores.find((c) => c.id === "instructions")!;
    const instrClaude = rClaude.categoryScores.find((c) => c.id === "instructions")!;
    expect(instrOther.checks.find((c) => c.id === "has_claude_md")!.weight).toBe(0.25);
    expect(instrClaude.checks.find((c) => c.id === "has_claude_md")!.weight).toBe(0.40);
    expect(instrOther.checks.find((c) => c.id === "has_contributing")!.weight).toBe(0.15);
    expect(instrClaude.checks.find((c) => c.id === "has_contributing")!.weight).toBe(0.00);
  });
});

describe("scoreProject — blocker ranking", () => {
  it("topBlockers sorted by categoryWeight * checkWeight descending", async () => {
    const ev = await collectEvidence(join(fixturesDir, "minimal"));
    const result = scoreProject(ev, { tool: "other" });
    const impacts = result.topBlockers.map((b) => {
      const cat = result.categoryScores.find((c) => c.id === b.categoryId)!;
      const catWeight =
        b.categoryId === "instructions"
          ? 0.25
          : b.categoryId === "context"
          ? 0.20
          : b.categoryId === "tooling"
          ? 0.20
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
