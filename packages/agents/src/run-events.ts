// Events emitted during an agent run for streaming / mission-control UIs.

export type AgentRunEvent =
  | {
      type: 'run.start';
      agent_id: string;
      depth: number;
      model: string;
    }
  | { type: 'iteration'; agent_id: string; iteration: number }
  | {
      type: 'assistant.delta';
      agent_id: string;
      /** Reasoning / preamble text before tool calls (if any). */
      text: string;
    }
  | {
      type: 'tool.proposed';
      agent_id: string;
      tool_id: string;
      policy: string;
      /** Trimmed arguments for UI */
      parameters_preview: string;
    }
  | { type: 'tool.executing'; agent_id: string; tool_id: string }
  | {
      type: 'tool.result';
      agent_id: string;
      tool_id: string;
      preview: string;
      /** When JSON parses and fits, for dashboards */
      structured?: unknown;
    }
  | { type: 'sub_agent.start'; parent_agent: string; child_agent: string }
  | {
      type: 'sub_agent.end';
      parent_agent: string;
      child_agent: string;
      status: string;
    }
  | {
      type: 'run.blocked';
      reason: 'approval' | 'refused' | 'failed';
      message: string;
      approval_id?: string;
    }
  | { type: 'run.complete'; agent_id: string; status: string };

export type RunAgentOptions = {
  subAgentDepth?: number;
  onEvent?: (event: AgentRunEvent) => void;
};
