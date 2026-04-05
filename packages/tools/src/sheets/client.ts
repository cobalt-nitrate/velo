const sheetStore = new Map<string, Array<Record<string, unknown>>>();

function keyForTableFromToolId(toolId: string): string {
  const parts = toolId.split('.');
  return parts.length > 1 ? parts[1] : 'default';
}

export async function executeSheetTool(
  params: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const toolId = String(params.tool_id ?? 'sheets.unknown.create');
  const table = keyForTableFromToolId(toolId);
  const row = (params.payload ?? {}) as Record<string, unknown>;
  const tableRows = sheetStore.get(table) ?? [];

  tableRows.push({
    ...row,
    id: `${table}_${Date.now()}_${tableRows.length + 1}`,
    created_at: new Date().toISOString(),
  });
  sheetStore.set(table, tableRows);

  return {
    ok: true,
    table,
    record_count: tableRows.length,
    latest: tableRows[tableRows.length - 1],
  };
}

export function listSheetTable(table: string): Array<Record<string, unknown>> {
  return sheetStore.get(table) ?? [];
}
