import type { AgentName, RepoEvidence, DeepAuditResult } from "../types.js";

export interface AgentAdapter {
  name: AgentName;
  detect(): Promise<boolean>;
  invoke(projectPath: string, evidence: RepoEvidence): Promise<DeepAuditResult>;
}

