// AgentRunner — the ReAct loop runtime.
// Loads agent config, calls the LLM, routes tool calls through PolicyEngine,
// scores confidence, and handles all branching (auto-execute, approval, refuse).
//
// No business logic lives here. All decisions come from:
//   - configs/agents/*.json (agent config)
//   - configs/prompts/*.md (system prompts)
//   - configs/policies/autopilot.json (policy rules)

import Anthropic from '@anthropic-ai/sdk';
import { loadAgentConfig, loadConfig, loadPrompt } from '@velo/core/config';
import { PolicyEngine } from '@velo/core/policy-engine';
import { scoreConfidence } from '@velo/core/confidence';
import type {
  AgentConfig,
  AgentContext,
  AgentResult,
} from '@velo/core/types';

// Tool registry — all tool implementations registered here at startup
// Tools are imported from @velo/tools and registered by ID
const toolRegistry = new Map<string, (...args: unknown[]) => Promise<unknown>>();

export function registerTool(
  toolId: string,
  fn: (...args: unknown[]) => Promise<unknown>
): void {
  toolRegistry.set(toolId, fn);
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export async function runAgent(
  agentId: string,
  input: unknown,
  context: AgentContext
): Promise<AgentResult> {
  const config = loadAgentConfig(agentId) as AgentConfig;
  const systemPrompt = loadPrompt(config.system_prompt_file);
  const autopilotPolicy = loadConfig('policies/autopilot');
  const policyEngine = new PolicyEngine(autopilotPolicy as Parameters<typeof PolicyEngine>[0]);

  const messages: Anthropic.MessageParam[] = [
    ...context.messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: JSON.stringify(input) },
  ];

  let iterations = 0;
  let auditEntryId = `audit-${Date.now()}-${agentId}`;

  while (iterations < config.max_iterations) {
    iterations++;

    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: 4096,
      system: systemPrompt,
      messages,
      tools: buildToolSchema(config.tools),
    });

    if (response.stop_reason === 'end_turn') {
      const textBlock = response.content.find((b) => b.type === 'text');
      const answer = textBlock?.type === 'text' ? textBlock.text : '';
      return {
        status: 'COMPLETED',
        output: answer,
        audit_entry_id: auditEntryId,
      };
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlock = response.content.find((b) => b.type === 'tool_use');
      if (!toolUseBlock || toolUseBlock.type !== 'tool_use') break;

      const toolCall = {
        tool_id: toolUseBlock.name,
        parameters: toolUseBlock.input as Record<string, unknown>,
      };

      // Score confidence
      // TODO: derive real inputs from context + tool call
      const confidence = scoreConfidence({
        extraction_completeness: 0.9,
        entity_match_quality: 0.9,
        category_match_quality: 0.9,
        historical_pattern_match: 0.7,
        data_freshness: 0.9,
      });

      // Policy check
      const policyResult = policyEngine.evaluate({
        action: toolCall,
        confidence: confidence.overall,
        actor_role: context.actor_role,
        agent_id: agentId,
      });

      if (policyResult === 'REFUSE') {
        return {
          status: 'REFUSED',
          error: `Action refused: confidence ${confidence.overall} is below minimum threshold.`,
          audit_entry_id: auditEntryId,
        };
      }

      if (policyResult === 'REQUEST_APPROVAL') {
        return {
          status: 'PENDING_APPROVAL',
          approval_id: `approval-${Date.now()}`,
          audit_entry_id: auditEntryId,
        };
      }

      if (policyResult === 'RECOMMEND_ONLY') {
        const textBlock = response.content.find((b) => b.type === 'text');
        return {
          status: 'COMPLETED',
          output: textBlock?.type === 'text' ? textBlock.text : '',
          audit_entry_id: auditEntryId,
        };
      }

      // AUTO_EXECUTE — run the tool
      const tool = toolRegistry.get(toolCall.tool_id);
      if (!tool) {
        throw new Error(`Tool not registered: ${toolCall.tool_id}`);
      }
      const toolResult = await tool(toolCall.parameters);

      // Feed result back into conversation
      messages.push({ role: 'assistant', content: response.content });
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          },
        ],
      });
    }
  }

  return {
    status: 'FAILED',
    error: 'Max iterations reached without resolution.',
    audit_entry_id: auditEntryId,
  };
}

function buildToolSchema(toolIds: string[]): Anthropic.Tool[] {
  // TODO: Load tool schemas from tool registry
  // For now returns empty — will be populated as tools are implemented
  return [];
}
