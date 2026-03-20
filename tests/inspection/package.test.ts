import { describe, it, expect } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { parsePackageSignals } from "../../src/inspection/package.js";

const fixturesDir = join(fileURLToPath(import.meta.url), "../../../fixtures");

describe("parsePackageSignals", () => {
  describe("minimal fixture", () => {
    it("detects package.json", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "minimal"));
      expect(result.hasPackageJson).toBe(true);
    });

    it("no lockfile", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "minimal"));
      expect(result.hasLockfile).toBe(false);
      expect(result.lockfileType).toBeUndefined();
    });

    it("no scripts", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "minimal"));
      expect(result.scripts.hasLint).toBe(false);
      expect(result.scripts.hasTypecheck).toBe(false);
      expect(result.scripts.hasTest).toBe(false);
      expect(result.scripts.hasBuild).toBe(false);
    });
  });

  describe("partial fixture", () => {
    it("detects npm lockfile", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "partial"));
      expect(result.hasLockfile).toBe(true);
      expect(result.lockfileType).toBe("npm");
    });

    it("has test script only", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "partial"));
      expect(result.scripts.hasTest).toBe(true);
      expect(result.scripts.hasLint).toBe(false);
      expect(result.scripts.hasTypecheck).toBe(false);
      expect(result.scripts.hasBuild).toBe(false);
    });
  });

  describe("strong fixture", () => {
    it("has all scripts", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "strong"));
      expect(result.scripts.hasLint).toBe(true);
      expect(result.scripts.hasTypecheck).toBe(true);
      expect(result.scripts.hasTest).toBe(true);
      expect(result.scripts.hasBuild).toBe(true);
    });

    it("detects npm lockfile", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "strong"));
      expect(result.hasLockfile).toBe(true);
      expect(result.lockfileType).toBe("npm");
    });
  });

  describe("ts-webapp fixture", () => {
    it("has all scripts", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "ts-webapp"));
      expect(result.scripts.hasLint).toBe(true);
      expect(result.scripts.hasTypecheck).toBe(true);
      expect(result.scripts.hasTest).toBe(true);
      expect(result.scripts.hasBuild).toBe(true);
    });

    it("detects pnpm lockfile", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "ts-webapp"));
      expect(result.hasLockfile).toBe(true);
      expect(result.lockfileType).toBe("pnpm");
    });
  });

  describe("missing path", () => {
    it("returns no package.json for non-existent path", async () => {
      const result = await parsePackageSignals("/nonexistent/path/nowhere");
      expect(result.hasPackageJson).toBe(false);
      expect(result.hasLockfile).toBe(false);
      expect(result.scripts.hasTest).toBe(false);
    });
  });
});
