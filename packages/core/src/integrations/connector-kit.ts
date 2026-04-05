/**
 * Integration boundary — implement these in your connector package or backend.
 * Velo core agents/runtime stay policy- and sheet-agnostic at this seam.
 */

import type { AgentContext } from '../types/agent.js';

/** Outbound notifications (Slack, email, WhatsApp adapters wrap this). */
export interface NotificationConnector {
  sendApprovalRequest(params: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
  sendDigest(params: Record<string, unknown>): Promise<{ ok: boolean; error?: string }>;
}

/** Optional: replace mock/in-memory sheet tools with your ERP / ledger HTTP APIs. */
export interface LedgerConnector {
  /** Stable id your system uses for idempotency (invoice id, payment id, …). */
  namespace: string;
  executeToolVeloShaped(toolId: string, params: Record<string, unknown>): Promise<unknown>;
}

/** Optional: custom LLM route — default runtime uses OpenAI-compatible HTTP + agent JSON configs. */
export interface ModelConnector {
  complete(
    messages: Array<{ role: string; content: string }>,
    tools?: unknown
  ): Promise<{ content?: string; tool_calls?: unknown }>;
}

/** Passed into workflow resume / chat handlers when your auth layer resolves a user. */
export type ConnectorAgentContextFactory = (input: {
  companyId: string;
  actorId: string;
  actorRole: string;
  sessionId: string;
}) => AgentContext;
