/** Canonicalize tool ids (trim + normalize as-is). */
export function canonicalVeloDataToolId(toolId: string): string {
  return String(toolId ?? '').trim();
}
