import { describe, it, expect } from "vitest";
import { join } from "path";
import { fileURLToPath } from "url";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { collectPackageSignals, parsePackageSignals } from "../../src/inspection/package.js";

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
      expect(result.hasArchitectureLints).toBe(false);
      expect(result.observabilityDependencies).toEqual([]);
      expect(result.scripts.hasLocalDevBootPath).toBe(false);
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
      expect(result.hasArchitectureLints).toBe(false);
      expect(result.scripts.hasLocalDevBootPath).toBe(false);
      expect(result.scripts.hasTest).toBe(true);
      expect(result.scripts.hasLint).toBe(false);
      expect(result.scripts.hasTypecheck).toBe(false);
      expect(result.scripts.hasBuild).toBe(false);
    });
  });

  describe("strong fixture", () => {
    it("has all scripts", async () => {
      const result = await parsePackageSignals(join(fixturesDir, "strong"));
      expect(result.hasArchitectureLints).toBe(true);
      expect(result.scripts.hasLocalDevBootPath).toBe(true);
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
      expect(result.hasArchitectureLints).toBe(true);
      expect(result.scripts.hasLocalDevBootPath).toBe(true);
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
      expect(result.hasArchitectureLints).toBe(false);
      expect(result.observabilityDependencies).toEqual([]);
      expect(result.scripts.hasLocalDevBootPath).toBe(false);
      expect(result.scripts.hasTest).toBe(false);
    });
  });

  describe("architecture lint detection", () => {
    it("detects dependency-cruiser config files", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-archlint-"));
      try {
        writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "arch-lints" }, null, 2), "utf-8");
        writeFileSync(join(dir, ".dependency-cruiser.js"), "module.exports = {};", "utf-8");

        const result = await parsePackageSignals(dir);
        expect(result.hasArchitectureLints).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("observability dependency detection", () => {
    it("detects known observability dependencies in package.json", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-observability-deps-"));
      try {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify(
            {
              name: "observability-deps",
              dependencies: {
                pino: "^9.0.0",
                "@sentry/node": "^8.0.0",
              },
              devDependencies: {
                "@opentelemetry/api": "^1.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );

        const result = await parsePackageSignals(dir);
        expect(result.observabilityDependencies).toEqual([
          "@opentelemetry/api",
          "@sentry/node",
          "pino",
        ]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("aggregates observability dependencies across discovered package roots", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-observability-mono-"));
      try {
        mkdirSync(join(dir, "backend"), { recursive: true });
        mkdirSync(join(dir, "frontend"), { recursive: true });

        writeFileSync(
          join(dir, "backend", "package.json"),
          JSON.stringify(
            {
              name: "backend",
              dependencies: {
                winston: "^3.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );
        writeFileSync(
          join(dir, "frontend", "package.json"),
          JSON.stringify(
            {
              name: "frontend",
              devDependencies: {
                "prom-client": "^15.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );

        const result = await collectPackageSignals(dir);
        expect(result.observabilityDependencies).toEqual(["prom-client", "winston"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("monorepo package aggregation", () => {
    it("aggregates signals from discovered package roots", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-mono-"));
      try {
        mkdirSync(join(dir, "backend"), { recursive: true });
        mkdirSync(join(dir, "frontend", "e2e"), { recursive: true });

        writeFileSync(
          join(dir, "backend", "package.json"),
          JSON.stringify(
            {
              name: "backend",
              scripts: {
                dev: "vite",
                lint: "eslint src --ext .ts",
              },
              devDependencies: {
                "dependency-cruiser": "^15.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );
        writeFileSync(join(dir, "backend", "package-lock.json"), "{}", "utf-8");
        writeFileSync(
          join(dir, "frontend", "package.json"),
          JSON.stringify(
            {
              name: "frontend",
              scripts: {
                test: "vitest run",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );

        const result = await collectPackageSignals(dir);
        expect(result.hasPackageJson).toBe(true);
        expect(result.hasLockfile).toBe(true);
        expect(result.hasArchitectureLints).toBe(true);
        expect(result.scripts.hasLocalDevBootPath).toBe(true);
        expect(result.scripts.hasLint).toBe(true);
        expect(result.scripts.hasTest).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });

    it("aggregates observability dependencies across discovered manifests", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-mono-observability-"));
      try {
        mkdirSync(join(dir, "apps", "web"), { recursive: true });
        mkdirSync(join(dir, "services", "api"), { recursive: true });

        writeFileSync(
          join(dir, "apps", "web", "package.json"),
          JSON.stringify(
            {
              name: "web",
              dependencies: {
                pino: "^9.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );
        writeFileSync(
          join(dir, "services", "api", "package.json"),
          JSON.stringify(
            {
              name: "api",
              dependencies: {
                "@sentry/node": "^8.0.0",
              },
              devDependencies: {
                pino: "^9.0.0",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );

        const result = await collectPackageSignals(dir);
        expect(result.observabilityDependencies).toEqual(["@sentry/node", "pino"]);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });

  describe("local dev boot path detection", () => {
    it("does not treat vite build as a local dev boot path", async () => {
      const dir = mkdtempSync(join(tmpdir(), "harness-package-test-"));
      try {
        writeFileSync(
          join(dir, "package.json"),
          JSON.stringify(
            {
              name: "vite-build-only",
              scripts: {
                build: "vite build",
              },
            },
            null,
            2,
          ),
          "utf-8",
        );

        const result = await parsePackageSignals(dir);
        expect(result.scripts.hasLocalDevBootPath).toBe(false);
        expect(result.scripts.hasBuild).toBe(true);
      } finally {
        rmSync(dir, { recursive: true, force: true });
      }
    });
  });
});
