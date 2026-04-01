import type {
  AgentName,
  DeepAuditContext,
  RepoEvidence,
  DeepAuditResult,
} from "../types.js";

export interface AgentAdapter {
  name: AgentName;
  detect(): Promise<boolean>;
  invoke(projectPath: string, evidence: RepoEvidence, context?: DeepAuditContext): Promise<DeepAuditResult>;
}
