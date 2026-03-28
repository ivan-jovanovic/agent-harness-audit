import type { AgentAdapter } from "./adapter.js";
import { ClaudeCodeAdapter } from "./claude-code.js";
import { CodexAdapter } from "./codex.js";
import type { AgentDiscoveryResult, AgentName } from "../types.js";

const AGENT_PRIORITY: AgentName[] = ["claude-code", "codex"];

function createAdapter(agent: AgentName): AgentAdapter {
  switch (agent) {
    case "claude-code":
      return new ClaudeCodeAdapter();
    case "codex":
      return new CodexAdapter();
  }
}

export async function discoverAgents(): Promise<AgentDiscoveryResult> {
  const available: AgentName[] = [];

  for (const agentName of AGENT_PRIORITY) {
    const adapter = createAdapter(agentName);
    if (await adapter.detect()) {
      available.push(agentName);
    }
  }

  return { available };
}

export function selectAgent(
  discovery: AgentDiscoveryResult,
  requested?: AgentName,
): AgentName | null {
  if (requested) {
    return discovery.available.includes(requested) ? requested : null;
  }

  for (const agentName of AGENT_PRIORITY) {
    if (discovery.available.includes(agentName)) {
      return agentName;
    }
  }

  return null;
}

export function getAgentAdapter(agentName: AgentName): AgentAdapter {
  return createAdapter(agentName);
}

