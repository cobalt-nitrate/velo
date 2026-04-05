import { getRuntimeTools } from '@velo/tools';

const handlers = new Map(
  getRuntimeTools().map((t) => [t.id, t.handler] as const)
);

export async function invokeRegisteredTool(
  toolId: string,
  parameters: Record<string, unknown>
): Promise<unknown> {
  const fn = handlers.get(toolId);
  if (!fn) throw new Error(`Unknown tool: ${toolId}`);
  return fn({ ...parameters, tool_id: toolId });
}
