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
import { createAuditEvent } from '@velo/core/audit';
import { getRuntimeTools } from '@velo/tools';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
  ToolActionMetadata,
  ToolSchema,
} from '@velo/core/types';

type ToolExecutor = (params: Record<string, unknown>) => Promise<unknown>;

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
  context: AgentContext
): Promise<AgentResult> {
  ensureRuntimeToolsRegistered();
  const client = getOpenAIClient();
  const config = loadAgentConfig(agentId) as AgentConfig;
  const systemPrompt = loadPrompt(config.system_prompt_file);
  const autopilotPolicy = loadConfig('policies/autopilot');
  const policyEngine = new PolicyEngine(
    autopilotPolicy as ConstructorParameters<typeof PolicyEngine>[0]
  );

  const resolvedModel = resolveAgentModel(config.model);
  const openaiTools = buildOpenAITools(config.tools);
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

  while (iterations < config.max_iterations) {
    iterations++;

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
      return {
        status: 'FAILED',
        error: 'Empty completion from LLM.',
        audit_entry_id: auditEntryId,
      };
    }

    const msg = choice.message;
    const toolCalls = msg.tool_calls;

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

      const scoringInputs = deriveScoringInputs({
        required_fields: ['amount', 'vendor_name', 'invoice_date'],
        extracted_fields: toolCall.parameters,
        entity_match_confidence: numberOrDefault(
          toolCall.parameters.entity_match_confidence,
          0.72
        ),
        category_match_confidence: numberOrDefault(
          toolCall.parameters.category_match_confidence,
          0.68
        ),
        historical_match_confidence: numberOrDefault(
          toolCall.parameters.historical_match_confidence,
          0.61
        ),
        data_age_hours: numberOrDefault(toolCall.parameters.data_age_hours, 6),
      });
      const confidence = scoreConfidence(scoringInputs);
      const metadata = deriveActionMetadata(toolCall);
      const policyResult = policyEngine.evaluate({
        action: toolCall,
        confidence: confidence.overall,
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
          metadata,
        },
      });

      evaluated.push({
        tc,
        toolCall,
        confidence,
        metadata,
        policyResult,
      });
    }

    const firstRefuse = evaluated.find((e) => e.policyResult === 'REFUSE');
    if (firstRefuse) {
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
      const tool = toolRegistry.get(item.toolCall.tool_id);
      if (!tool) {
        throw new Error(`Tool not registered: ${item.toolCall.tool_id}`);
      }
      const toolResult = await tool({
        ...item.toolCall.parameters,
        tool_id: item.toolCall.tool_id,
        company_id: context.company_id,
      });
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
