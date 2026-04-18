// AgentRunner — the ReAct loop runtime.
// Calls an OpenAI-compatible HTTP API (e.g. NVIDIA NIM), routes tool calls through
// PolicyEngine, scores confidence, and handles auto / approval / refuse.
//
// Configure via env:
//   LLM_API_KEY, LLM_BASE_URL (see .env.local.example)
// Agent JSON may use ${LLM_MODEL_ORCHESTRATOR} etc.; fallback: LLM_MODEL_DEFAULT.

import OpenAI from 'openai';
import { loadAgentConfig, loadConfig, loadPrompt } from '@velo/core/config';
import { PolicyEngine } from '@velo/core/policy-engine';
import { deriveScoringInputs, scoreConfidence } from '@velo/core/confidence';
import {
  appendDecisionMemory,
  createAuditEvent,
  registerAuditSheetsFlush,
} from '@velo/core';
import { getRuntimeTools } from '@velo/tools';
import { appendAuditRow, executeSheetTool } from '@velo/tools/sheets';
import { notifyApprovalRequestOutOfBand } from './approval-notify.js';
import { adjustConfidenceForPolicyRisk } from './confidence-policy-bridge.js';
import { scoringSignalsForTool } from './tool-confidence.js';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  ApprovalRequest,
  ToolActionMetadata,
  ToolSchema,
} from '@velo/core/types';
import type { AgentRunEvent, RunAgentOptions } from './run-events.js';

export type { AgentRunEvent, RunAgentOptions } from './run-events.js';

registerAuditSheetsFlush(appendAuditRow);

function shouldRecordAutoDecisionMemory(toolId: string): boolean {
  if (toolId === 'internal.platform.healthcheck') return false;
  const lower = toolId.toLowerCase();
  if (lower.includes('internal.sub_agent')) return false;
  if (lower.includes('.get_')) return false;
  if (lower.includes('.lookup') || lower.includes('lookup_by')) return false;
  if (lower.includes('.find_by_')) return false;
  return true;
}

function toolOutcomeSuccess(toolResult: unknown): boolean {
  if (toolResult === null || toolResult === undefined) return false;
  if (typeof toolResult !== 'object') return true;
  const o = toolResult as Record<string, unknown>;
  if ('ok' in o && o.ok === false) return false;
  return true;
}

function emitEvent(
  onEvent: ((e: AgentRunEvent) => void) | undefined,
  event: AgentRunEvent
): void {
  if (!onEvent) return;
  try {
    onEvent(event);
  } catch {
    /* streaming client must not break the run */
  }
}

function summarizeParams(p: Record<string, unknown>, max = 1200): string {
  try {
    const s = JSON.stringify(p);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return '[parameters]';
  }
}

function previewToolJson(data: unknown, max = 3600): string {
  try {
    const s = typeof data === 'string' ? data : JSON.stringify(data);
    return s.length > max ? `${s.slice(0, max)}…` : s;
  } catch {
    return String(data);
  }
}

function structuredPayload(data: unknown): unknown | undefined {
  if (data === null || data === undefined) return undefined;
  try {
    const s = JSON.stringify(data);
    if (s.length > 32_000) return undefined;
    return JSON.parse(s) as unknown;
  } catch {
    return undefined;
  }
}

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>;

async function persistApprovalRequestSheet(
  approvalRequest: ApprovalRequest,
  companyId: string
): Promise<void> {
  try {
    const result = await executeSheetTool({
      tool_id: 'sheets.approval_requests.create',
      company_id: companyId,
      approval_id: approvalRequest.approval_id,
      agent_id: approvalRequest.agent_id,
      action_type: approvalRequest.action_type,
      action_payload_json: JSON.stringify(approvalRequest.action_payload),
      confidence_score: String(approvalRequest.confidence_score),
      evidence_json: JSON.stringify(approvalRequest.evidence),
      proposed_action_text: approvalRequest.proposed_action_text,
      created_at: approvalRequest.created_at,
      expires_at: approvalRequest.expires_at,
      status: approvalRequest.status,
      approver_role: approvalRequest.approver_role,
      resolved_by: '',
      resolved_at: '',
      resolution_notes: '',
    });
    if (result.ok === false) {
      console.error(
        '[runner] sheets.approval_requests.create did not succeed:',
        result.error ?? result
      );
    }
  } catch (err) {
    console.error('[runner] Failed to persist approval request:', err);
  }
}

const toolRegistry = new Map<string, ToolExecutor>();
const toolSchemaRegistry = new Map<string, ToolSchema>();
let toolsInitialized = false;

let openaiClient: OpenAI | null = null;

export function registerTool(
  toolId: string,
  fn: ToolExecutor,
  schema?: ToolSchema
): void {
  toolRegistry.set(toolId, fn);
  if (schema) {
    toolSchemaRegistry.set(toolId, schema);
  }
}

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.LLM_API_KEY ?? process.env.OPENAI_API_KEY;
  const baseURL =
    process.env.LLM_BASE_URL ??
    process.env.OPENAI_BASE_URL ??
    'https://integrate.api.nvidia.com/v1';
  if (!apiKey?.trim()) {
    throw new Error(
      'LLM_API_KEY is missing. Set it in .env.local for NVIDIA NIM (OpenAI-compatible API).'
    );
  }
  openaiClient = new OpenAI({ apiKey, baseURL });
  return openaiClient;
}

export async function runAgent(
  agentId: string,
  input: unknown,
  context: AgentContext,
  options?: number | RunAgentOptions
): Promise<AgentResult> {
  const opts: RunAgentOptions =
    typeof options === 'number' ? { subAgentDepth: options } : (options ?? {});
  const subAgentDepth = opts.subAgentDepth ?? 0;
  const onEvent = opts.onEvent;
  ensureRuntimeToolsRegistered();
  const client = getOpenAIClient();
  const config = loadAgentConfig(agentId) as AgentConfig;
  const systemPrompt = loadPrompt(config.system_prompt_file);
  const autopilotPolicy = loadConfig('policies/autopilot');
  const policyEngine = new PolicyEngine(
    autopilotPolicy as ConstructorParameters<typeof PolicyEngine>[0]
  );

  const resolvedModel = resolveAgentModel(config.model);
  const mergedToolIds = [...config.tools];
  if (config.sub_agents?.length) {
    mergedToolIds.push('internal.sub_agent.invoke');
  }
  const openaiTools = buildOpenAITools(mergedToolIds);
  const useTools = openaiTools.length > 0;

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
  for (const m of context.messages) {
    if (m.role === 'system') continue;
    chatMessages.push({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    });
  }
  chatMessages.push({
    role: 'user',
    content: typeof input === 'string' ? input : JSON.stringify(input),
  });

  let iterations = 0;
  const startAudit = createAuditEvent({
    company_id: context.company_id,
    actor_id: context.actor_id,
    actor_role: context.actor_role,
    agent_id: agentId,
    event_type: 'AGENT_STARTED',
    payload: {
      input,
      session_id: context.session_id,
      model: resolvedModel,
    },
  });
  let auditEntryId = startAudit.id;

  if (subAgentDepth > 5) {
    createAuditEvent({
      company_id: context.company_id,
      actor_id: context.actor_id,
      actor_role: context.actor_role,
      agent_id: agentId,
      event_type: 'AGENT_FAILED',
      payload: { reason: 'sub_agent_depth_exceeded', session_id: context.session_id },
    });
    return {
      status: 'FAILED',
      error: 'Sub-agent nesting exceeded maximum depth.',
      audit_entry_id: auditEntryId,
    };
  }

  emitEvent(onEvent, {
    type: 'run.start',
    agent_id: agentId,
    depth: subAgentDepth,
    model: resolvedModel,
  });

  while (iterations < config.max_iterations) {
    iterations++;

    emitEvent(onEvent, {
      type: 'iteration',
      agent_id: agentId,
      iteration: iterations,
    });

    const completion = await client.chat.completions.create({
      model: resolvedModel,
      max_tokens: 4096,
      messages: [{ role: 'system', content: systemPrompt }, ...chatMessages],
      ...(useTools
        ? { tools: openaiTools, tool_choice: 'auto' as const }
        : {}),
    });

    const choice = completion.choices[0];
    if (!choice?.message) {
      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'AGENT_FAILED',
        payload: {
          reason: 'empty_llm_completion',
          session_id: context.session_id,
          iteration: iterations,
        },
      });
      return {
        status: 'FAILED',
        error: 'Empty completion from LLM.',
        audit_entry_id: auditEntryId,
      };
    }

    const msg = choice.message;
    const toolCalls = msg.tool_calls;

    if (msg.content?.trim()) {
      emitEvent(onEvent, {
        type: 'assistant.delta',
        agent_id: agentId,
        text: msg.content ?? '',
      });
    }

    if (!toolCalls?.length) {
      const answer = msg.content ?? '';
      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'AGENT_COMPLETED',
        payload: {
          iterations,
          answer,
          finish_reason: choice.finish_reason,
        },
      });
      emitEvent(onEvent, {
        type: 'run.complete',
        agent_id: agentId,
        status: 'COMPLETED',
      });
      return {
        status: 'COMPLETED',
        output: answer,
        audit_entry_id: auditEntryId,
      };
    }

    type EvaluatedCall = {
      tc: OpenAI.Chat.ChatCompletionMessageToolCall;
      toolCall: { tool_id: string; parameters: Record<string, unknown> };
      confidence: ReturnType<typeof scoreConfidence>;
      metadata: ToolActionMetadata;
      policyResult: ReturnType<PolicyEngine['evaluate']>;
    };

    const evaluated: EvaluatedCall[] = [];
    for (const tc of toolCalls) {
      if (tc.type !== 'function') {
        throw new Error(
          `Unsupported tool call type "${tc.type}" (only "function" is supported for NVIDIA/OpenAI-compatible APIs).`
        );
      }
      const name = tc.function.name;
      let parameters: Record<string, unknown> = {};
      try {
        parameters = JSON.parse(tc.function.arguments || '{}') as Record<
          string,
          unknown
        >;
      } catch {
        parameters = {};
      }
      const toolCall = { tool_id: name, parameters };

      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'TOOL_PROPOSED',
        payload: { tool_call: toolCall },
      });

      if (name === 'internal.sub_agent.invoke') {
        const confidence = scoreConfidence(
          deriveScoringInputs(scoringSignalsForTool(name, parameters))
        );
        const metadata = deriveActionMetadata(toolCall);
        createAuditEvent({
          company_id: context.company_id,
          actor_id: context.actor_id,
          actor_role: context.actor_role,
          agent_id: agentId,
          event_type: 'POLICY_DECISION',
          payload: {
            tool_id: toolCall.tool_id,
            policy_result: 'AUTO_EXECUTE',
            confidence,
            metadata,
            note: 'sub-agent delegation',
          },
        });
        evaluated.push({
          tc,
          toolCall,
          confidence,
          metadata,
          policyResult: 'AUTO_EXECUTE',
        });
        emitEvent(onEvent, {
          type: 'tool.proposed',
          agent_id: agentId,
          tool_id: toolCall.tool_id,
          policy: 'AUTO_EXECUTE',
          parameters_preview: summarizeParams(parameters),
        });
        continue;
      }

      const scoringInputs = deriveScoringInputs(
        scoringSignalsForTool(toolCall.tool_id, toolCall.parameters)
      );
      const confidence = scoreConfidence(scoringInputs);
      const metadata = deriveActionMetadata(toolCall);
      const autopilot = autopilotPolicy as {
        payment_auto_threshold_inr?: number;
      };
      const { adjusted: adjustedConfidence, notes: riskNotes } =
        adjustConfidenceForPolicyRisk({
          baseConfidence: confidence.overall,
          toolId: toolCall.tool_id,
          amountInr: metadata.amount_inr,
          paymentAutoThresholdInr: numberOrDefault(
            autopilot.payment_auto_threshold_inr,
            25000
          ),
          isFilingAction: metadata.is_filing_action ?? false,
        });
      const policyResult = policyEngine.evaluate({
        action: toolCall,
        confidence: adjustedConfidence,
        actor_role: context.actor_role,
        agent_id: agentId,
        metadata,
      });

      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'POLICY_DECISION',
        payload: {
          tool_id: toolCall.tool_id,
          policy_result: policyResult,
          confidence,
          confidence_adjusted: adjustedConfidence,
          confidence_risk_notes: riskNotes,
          metadata,
        },
      });

      evaluated.push({
        tc,
        toolCall,
        confidence: {
          ...confidence,
          overall: adjustedConfidence,
        },
        metadata,
        policyResult,
      });
      emitEvent(onEvent, {
        type: 'tool.proposed',
        agent_id: agentId,
        tool_id: toolCall.tool_id,
        policy: policyResult,
        parameters_preview: summarizeParams(parameters),
      });
    }

    const firstRefuse = evaluated.find((e) => e.policyResult === 'REFUSE');
    if (firstRefuse) {
      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'AGENT_FAILED',
        payload: {
          reason: 'refused',
          tool_id: firstRefuse.toolCall.tool_id,
          confidence: firstRefuse.confidence.overall,
          session_id: context.session_id,
        },
      });
      emitEvent(onEvent, {
        type: 'run.blocked',
        reason: 'refused',
        message: `Refused: ${firstRefuse.toolCall.tool_id}`,
      });
      return {
        status: 'REFUSED',
        error: `Action refused: RBAC, confidence floor, or policy blocked tool ${firstRefuse.toolCall.tool_id} (confidence ${firstRefuse.confidence.overall}).`,
        audit_entry_id: auditEntryId,
      };
    }

    const firstApproval = evaluated.find(
      (e) => e.policyResult === 'REQUEST_APPROVAL'
    );
    if (firstApproval) {
      const { toolCall, confidence, metadata } = firstApproval;
      const approvalRequest = {
        approval_id: `approval-${Date.now()}`,
        agent_id: agentId,
        tool_id: toolCall.tool_id,
        action_type: metadata.action_type ?? toolCall.tool_id,
        action_payload: toolCall.parameters,
        confidence_score: confidence.overall,
        evidence: [
          {
            type: 'sheet_data' as const,
            summary: `Confidence breakdown: ${JSON.stringify(
              confidence.breakdown
            )}`,
          },
        ],
        proposed_action_text: `Approve ${toolCall.tool_id}`,
        created_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
        status: 'PENDING' as const,
        approver_role: resolveApproverRole(context.actor_role),
      };

      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'APPROVAL_REQUESTED',
        payload: { approval_request: approvalRequest },
      });

      await persistApprovalRequestSheet(approvalRequest, context.company_id);
      await notifyApprovalRequestOutOfBand(approvalRequest, context.company_id);

      emitEvent(onEvent, {
        type: 'run.blocked',
        reason: 'approval',
        message: approvalRequest.proposed_action_text,
        approval_id: approvalRequest.approval_id,
      });
      return {
        status: 'PENDING_APPROVAL',
        approval_id: approvalRequest.approval_id,
        approval_request: approvalRequest,
        audit_entry_id: auditEntryId,
      };
    }

    const firstRecommend = evaluated.find(
      (e) => e.policyResult === 'RECOMMEND_ONLY'
    );
    if (firstRecommend) {
      emitEvent(onEvent, {
        type: 'run.complete',
        agent_id: agentId,
        status: 'COMPLETED',
      });
      return {
        status: 'COMPLETED',
        output: msg.content ?? '',
        audit_entry_id: auditEntryId,
      };
    }

    chatMessages.push({
      role: 'assistant',
      content: msg.content,
      tool_calls: msg.tool_calls,
    });

    for (const item of evaluated) {
      if (item.toolCall.tool_id === 'internal.sub_agent.invoke') {
        const sid = String(item.toolCall.parameters.sub_agent_id ?? '');
        const rawIn =
          item.toolCall.parameters.input ?? item.toolCall.parameters.message ?? '';
        const sin =
          typeof rawIn === 'string' ? rawIn : JSON.stringify(rawIn);
        emitEvent(onEvent, {
          type: 'sub_agent.start',
          parent_agent: agentId,
          child_agent: sid,
        });
        const subResult = await runAgent(sid, sin, context, {
          subAgentDepth: subAgentDepth + 1,
          onEvent,
        });
        emitEvent(onEvent, {
          type: 'sub_agent.end',
          parent_agent: agentId,
          child_agent: sid,
          status: subResult.status,
        });
        if (
          subResult.status === 'PENDING_APPROVAL' ||
          subResult.status === 'REFUSED' ||
          subResult.status === 'FAILED'
        ) {
          return subResult;
        }
        createAuditEvent({
          company_id: context.company_id,
          actor_id: context.actor_id,
          actor_role: context.actor_role,
          agent_id: agentId,
          event_type: 'TOOL_EXECUTED',
          payload: {
            tool_id: item.toolCall.tool_id,
            tool_result: subResult,
          },
        });
        chatMessages.push({
          role: 'tool',
          tool_call_id: item.tc.id,
          content: JSON.stringify(subResult),
        });
        continue;
      }

      const tool = toolRegistry.get(item.toolCall.tool_id);
      if (!tool) {
        throw new Error(`Tool not registered: ${item.toolCall.tool_id}`);
      }
      emitEvent(onEvent, {
        type: 'tool.executing',
        agent_id: agentId,
        tool_id: item.toolCall.tool_id,
      });
      const toolResult = await tool({
        ...item.toolCall.parameters,
        tool_id: item.toolCall.tool_id,
        company_id: context.company_id,
      });
      emitEvent(onEvent, {
        type: 'tool.result',
        agent_id: agentId,
        tool_id: item.toolCall.tool_id,
        preview: previewToolJson(toolResult),
        structured: structuredPayload(toolResult),
      });
      if (
        item.policyResult === 'AUTO_EXECUTE' &&
        shouldRecordAutoDecisionMemory(item.toolCall.tool_id) &&
        toolOutcomeSuccess(toolResult)
      ) {
        appendDecisionMemory({
          tool_id: item.toolCall.tool_id,
          parameters: {
            ...item.toolCall.parameters,
            company_id: context.company_id,
          },
          outcome: 'auto_executed',
          actor_id: context.actor_id,
        });
      }
      createAuditEvent({
        company_id: context.company_id,
        actor_id: context.actor_id,
        actor_role: context.actor_role,
        agent_id: agentId,
        event_type: 'TOOL_EXECUTED',
        payload: {
          tool_id: item.toolCall.tool_id,
          tool_result: toolResult,
        },
      });

      chatMessages.push({
        role: 'tool',
        tool_call_id: item.tc.id,
        content: JSON.stringify(toolResult),
      });
    }
  }

  createAuditEvent({
    company_id: context.company_id,
    actor_id: context.actor_id,
    actor_role: context.actor_role,
    agent_id: agentId,
    event_type: 'AGENT_FAILED',
    payload: {
      reason: 'max_iterations',
      max_iterations: config.max_iterations,
      session_id: context.session_id,
    },
  });
  emitEvent(onEvent, {
    type: 'run.complete',
    agent_id: agentId,
    status: 'FAILED',
  });
  return {
    status: 'FAILED',
    error: 'Max iterations reached without resolution.',
    audit_entry_id: auditEntryId,
  };
}

function buildOpenAITools(
  toolIds: string[]
): OpenAI.Chat.ChatCompletionTool[] {
  const out: OpenAI.Chat.ChatCompletionTool[] = [];
  for (const id of toolIds) {
    const schema = toolSchemaRegistry.get(id);
    if (!schema) continue;
    out.push({
      type: 'function',
      function: {
        name: schema.id,
        description: schema.description || id,
        parameters: schema.input_schema as OpenAI.FunctionParameters,
      },
    });
  }
  return out;
}

function numberOrDefault(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function deriveActionMetadata(toolCall: {
  tool_id: string;
  parameters: Record<string, unknown>;
}): ToolActionMetadata {
  const parts = toolCall.tool_id.split('.');
  const module = parts[1] ?? 'unknown';
  const action = parts[2] ?? 'execute';
  const amount =
    numberOrDefault(toolCall.parameters.amount_inr, NaN) ||
    numberOrDefault(toolCall.parameters.amount, NaN);

  const isFilingAction =
    toolCall.tool_id.includes('file_') || toolCall.tool_id.includes('filing');

  return {
    amount_inr: Number.isFinite(amount) ? amount : undefined,
    action_type: `${module}.${action}`,
    is_filing_action: isFilingAction,
    module,
  };
}

function resolveApproverRole(actorRole: string): string {
  if (actorRole === 'employee') return 'hr_lead';
  if (actorRole === 'hr_lead') return 'founder';
  if (actorRole === 'finance_lead') return 'founder';
  return 'founder';
}

function ensureRuntimeToolsRegistered(): void {
  if (toolsInitialized) return;
  const tools = getRuntimeTools();
  for (const tool of tools) {
    registerTool(tool.id, tool.handler, {
      id: tool.id,
      description: tool.description,
      input_schema: tool.schema,
    });
  }
  toolsInitialized = true;
}

function resolveAgentModel(model: string): string {
  const t = model.trim();
  if (t.startsWith('${') && t.endsWith('}')) {
    const key = t.slice(2, -1);
    const fromEnv = process.env[key];
    if (fromEnv?.trim()) return fromEnv.trim();
    const fallback = process.env.LLM_MODEL_DEFAULT?.trim();
    if (fallback) return fallback;
    throw new Error(
      `Model env "${key}" is unset and LLM_MODEL_DEFAULT is missing. Set NVIDIA model IDs in .env.local (see .env.local.example).`
    );
  }
  return t;
}
