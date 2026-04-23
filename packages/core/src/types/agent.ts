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

export interface ToolActionMetadata {
  amount_inr?: number;
  action_type?: string;
  is_filing_action?: boolean;
  module?: string;
}

export interface ToolSchema {
  id: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface AgentResult {
  status: 'COMPLETED' | 'PENDING_APPROVAL' | 'PENDING_CONFIRMATION' | 'FAILED' | 'REFUSED';
  output?: unknown;
  approval_id?: string;
  approval_request?: ApprovalRequest;
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
  /** Full Velo tool id (e.g. data.ap_invoices.create) — used to resume workflows after approval. */
  tool_id?: string;
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
  type: 'invoice_image' | 'past_payments' | 'policy_rule' | 'bank_transaction' | 'data_snapshot';
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

export interface WorkflowStep {
  step: number;
  id: string;
  action?: string;
  agent?: string;
  tool?: string;
  input_from?: unknown;
  output_to?: string;
  requires_policy_check?: boolean;
  condition?: string;
  [key: string]: unknown;
}

export interface WorkflowDefinition {
  id: string;
  label: string;
  description?: string;
  trigger: string;
  required_params?: string[];
  steps: WorkflowStep[];
}

export type WorkflowRunStatus =
  | 'RUNNING'
  | 'PAUSED'
  | 'WAITING_FOR_APPROVAL'
  | 'COMPLETED'
  | 'FAILED';

export interface WorkflowRunState {
  workflow_id: string;
  /** Key for loadConfig(\`workflows/${key}.json\`). Required for resume (new runs always set this). */
  workflow_config_key?: string;
  run_id: string;
  status: WorkflowRunStatus;
  current_step: number;
  context: Record<string, unknown>;
  started_at: string;
  updated_at: string;
  error?: string;
  /** When status is WAITING_FOR_APPROVAL, the sheet approval row id and deferred tool call. */
  pending_approval_id?: string;
  pending_tool_id?: string;
  pending_tool_params?: Record<string, unknown>;
}

/** Minimal shared entity shape for module UIs and connectors (Wave 1 contract). */
export type VeloModuleId =
  | 'runway'
  | 'compliance'
  | 'payroll'
  | 'ap'
  | 'ar'
  | 'hr'
  | 'helpdesk'
  | 'system';

export type VeloEntityWorkflowStatus =
  | 'DRAFT'
  | 'IN_PROGRESS'
  | 'WAITING_APPROVAL'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'FAILED';

/** Use when writing new code paths; Sheets rows may still use loose strings. */
export interface VeloWorkflowEntityBase {
  id: string;
  module: VeloModuleId;
  status: VeloEntityWorkflowStatus;
  confidence: number;
  policy_result: PolicyResult;
  owner_role: 'founder' | 'finance_lead' | 'hr_lead' | 'employee' | 'system';
  evidence_refs: string[];
  audit_entry_id?: string;
  updated_at: string;
}
