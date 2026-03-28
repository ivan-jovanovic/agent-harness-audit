import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../src/agents/command.js", () => ({
  runCommand: vi.fn(),
}));

import { discoverAgents, selectAgent } from "../../src/agents/index.js";
import { runCommand } from "../../src/agents/command.js";

const runCommandMock = vi.mocked(runCommand);

describe("agents/index", () => {
  beforeEach(() => {
    runCommandMock.mockReset();
  });

  it("discoverAgents returns available agents based on version probes", async () => {
    runCommandMock.mockImplementation(async (command) => {
      if (command === "claude") {
        return { stdout: "claude 1", stderr: "", exitCode: 0, signal: null, durationMs: 5 };
      }
      return { stdout: "", stderr: "not found", exitCode: 1, signal: null, durationMs: 5 };
    });

    const discovery = await discoverAgents();
    expect(discovery.available).toEqual(["claude-code"]);
  });

  it("selectAgent auto-selects claude-code first, then codex", () => {
    expect(selectAgent({ available: ["codex"] })).toBe("codex");
    expect(selectAgent({ available: ["codex", "claude-code"] })).toBe("claude-code");
  });

  it("selectAgent returns null when requested agent is unavailable", () => {
    expect(selectAgent({ available: ["claude-code"] }, "codex")).toBeNull();
  });
});

