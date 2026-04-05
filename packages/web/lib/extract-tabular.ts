/** Pull a simple table shape from connector / tool JSON for dashboard preview. */

export interface TabularPreview {
  title?: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

function isPlainObjectRow(x: unknown): x is Record<string, unknown> {
  return (
    typeof x === 'object' &&
    x !== null &&
    !Array.isArray(x) &&
    Object.keys(x as object).length > 0
  );
}

export function extractTabular(raw: unknown): TabularPreview | null {
  if (raw === null || raw === undefined) return null;

  if (Array.isArray(raw) && raw.length > 0 && raw.every(isPlainObjectRow)) {
    const columns = Object.keys(raw[0]!);
    return { columns, rows: raw as Record<string, unknown>[] };
  }

  if (typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const keys = ['rows', 'data', 'items', 'records', 'lines', 'entries'] as const;
  for (const key of keys) {
    const v = o[key];
    const inner = extractTabular(v);
    if (inner) {
      return {
        ...inner,
        title: inner.title ?? String(key),
      };
    }
  }

  return null;
}
