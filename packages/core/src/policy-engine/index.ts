// PolicyEngine — pure function, zero LLM calls.
// Loads policy config at startup. Evaluates every proposed action.
// This is the last gate before any tool execution.

import type { PolicyResult, ToolActionMetadata, ToolCall } from '../types/agent.js';

interface AutopilotPolicy {
  payment_auto_threshold_inr: number;
  filing_auto_execute: boolean;
  confidence_thresholds: {
    auto_execute_min: number;
    request_approval_min: number;
    recommend_only_min: number;
    refuse_below: number;
  };
  action_overrides: Array<{
    action_type: string;
    policy: 'NEVER_AUTO_EXECUTE' | 'REQUEST_APPROVAL' | 'AUTO_EXECUTE';
    reason?: string;
  }>;
  rbac: Record<string, string[]>;
}

export class PolicyEngine {
  private policy: AutopilotPolicy;

  constructor(policy: AutopilotPolicy) {
    this.policy = policy;
  }

  evaluate(params: {
    action: ToolCall;
    confidence: number;
    actor_role: string;
    agent_id: string;
    metadata?: ToolActionMetadata;
  }): PolicyResult {
    const { action, confidence, actor_role, agent_id, metadata } = params;
    const actionType = this.resolveActionType(action.tool_id, agent_id);

    // Step 1: RBAC check
    if (!this.isAuthorized(actor_role, actionType)) {
      return 'REFUSE';
    }

    // Step 2: Confidence below floor → refuse
    if (confidence < this.policy.confidence_thresholds.refuse_below) {
      return 'REFUSE';
    }

    // Step 3: Check action_overrides first (highest priority)
    const override = this.policy.action_overrides.find(
      (o) => o.action_type === actionType
    );
    if (override) {
      if (override.policy === 'NEVER_AUTO_EXECUTE') return 'REQUEST_APPROVAL';
      if (override.policy === 'REQUEST_APPROVAL') return 'REQUEST_APPROVAL';
      if (override.policy === 'AUTO_EXECUTE') {
        return confidence >= this.policy.confidence_thresholds.auto_execute_min
          ? 'AUTO_EXECUTE'
          : 'REQUEST_APPROVAL';
      }
    }

    // Step 4: Domain-specific hard rules from config
    if (metadata?.is_filing_action && !this.policy.filing_auto_execute) {
      return 'REQUEST_APPROVAL';
    }
    if (
      typeof metadata?.amount_inr === 'number' &&
      metadata.amount_inr > this.policy.payment_auto_threshold_inr
    ) {
      return 'REQUEST_APPROVAL';
    }

    // Step 5: Default safe policy for uncovered high-impact actions
    if (this.isHighImpactAction(actionType) && !override) {
      if (confidence >= this.policy.confidence_thresholds.auto_execute_min) {
        return 'REQUEST_APPROVAL';
      }
    }

    // Step 6: Confidence-based routing (no override)
    if (confidence >= this.policy.confidence_thresholds.auto_execute_min) {
      return 'AUTO_EXECUTE';
    }
    if (confidence >= this.policy.confidence_thresholds.request_approval_min) {
      return 'REQUEST_APPROVAL';
    }
    if (confidence >= this.policy.confidence_thresholds.recommend_only_min) {
      return 'RECOMMEND_ONLY';
    }
    return 'REFUSE';
  }

  private isAuthorized(role: string, actionType: string): boolean {
    const allowed = this.policy.rbac[role] ?? [];
    if (allowed.includes('*')) return true;
    return allowed.some(
      (pattern) =>
        pattern === actionType ||
        (pattern.endsWith('.*') && actionType.startsWith(pattern.slice(0, -2)))
    );
  }

  private resolveActionType(tool_id: string, agent_id: string): string {
    // Map tool_id to action_type for policy matching
    // e.g., "sheets.ap_invoices.create" → "ap_invoice.create"
    const parts = tool_id.split('.');
    if (parts.length >= 2) return `${parts[1]}.${parts[2] ?? '*'}`;
    return tool_id;
  }

  private isHighImpactAction(actionType: string): boolean {
    const highImpactPrefixes = ['payroll.', 'compliance.', 'bank.', 'employee.'];
    return highImpactPrefixes.some((prefix) => actionType.startsWith(prefix));
  }
}
