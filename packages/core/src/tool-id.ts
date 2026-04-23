/** Normalize Postgres-era `data.*` tool ids to the legacy `sheets.*` dispatch namespace. */

export function canonicalVeloDataToolId(toolId: string): string {
  if (toolId.startsWith('data.')) return `sheets.${toolId.slice(5)}`;
  return toolId;
}
