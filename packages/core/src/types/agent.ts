// All agent-related TypeScript types.
// No business logic here — types only.

export type PolicyResult =
  | 'AUTO_EXECUTE'
  | 'REQUEST_APPROVAL'
  | 'RECOMMEND_ONLY'
  | 'REFUSE';

export type AlertsMode = 'only_critical' | 'balanced' | 'verbose';

export interface AgentConfig {
  id: string;
  label: string;
  description: string;
  model: string;
  system_prompt_file: string;
  sub_agents: string[];
  tools: string[];
  confidence_thresholds: {
    auto_execute: number;
    request_approval: number;
    recommend_only: number;
    refuse: number;
  };
  max_iterations: number;
  timeout_seconds: number;
}

export interface AgentContext {
  messages: ConversationMessage[];
  company_id: string;
  actor_id: string;
  actor_role: string;
  session_id: string;
  memory: Record<string, unknown>;
  observations: Observation[];
}

export interface ConversationMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
}

export interface Observation {
  tool_id: string;
  input: unknown;
  output: unknown;
  timestamp: string;
}

export interface AgentThought {
  type: 'FINAL_ANSWER' | 'TOOL_CALL' | 'SPAWN_SUB_AGENT' | 'APPROVAL_REQUEST';
  reasoning: string;
  tool_call?: ToolCall;
  sub_agent_id?: string;
  sub_agent_input?: unknown;
  final_answer?: string;
}

export interface ToolCall {
  tool_id: string;
  parameters: Record<string, unknown>;
}

export interface AgentResult {
  status: 'COMPLETED' | 'PENDING_APPROVAL' | 'PENDING_CONFIRMATION' | 'FAILED' | 'REFUSED';
  output?: unknown;
  approval_id?: string;
  confirmation_request?: ConfirmationRequest;
  error?: string;
  audit_entry_id: string;
}

export interface ConfirmationRequest {
  message: string;
  options: string[];
  context: Record<string, unknown>;
}

export interface ApprovalRequest {
  approval_id: string;
  agent_id: string;
  action_type: string;
  action_payload: Record<string, unknown>;
  confidence_score: number;
  evidence: EvidenceItem[];
  proposed_action_text: string;
  created_at: string;
  expires_at: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
  approver_role: string;
}

export interface EvidenceItem {
  type: 'invoice_image' | 'past_payments' | 'policy_rule' | 'bank_transaction' | 'sheet_data';
  ref?: string;
  summary?: string;
  text?: string;
}

export interface ConfidenceScore {
  overall: number;
  breakdown: {
    extraction_completeness: number;
    entity_match_quality: number;
    category_match_quality: number;
    historical_pattern_match: number;
    data_freshness: number;
  };
}
