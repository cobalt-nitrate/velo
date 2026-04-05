import type { OpsTriageDomain } from '@/lib/operations-triage';

export const OPERATIONS_CHAT_HANDOFF_KEY = 'velo.operations.chat_handoff.v1';

export type OperationsChatHandoff = {
  domain: OpsTriageDomain;
  row: Record<string, unknown>;
  savedAt: string;
};

export function saveOperationsChatHandoff(payload: Omit<OperationsChatHandoff, 'savedAt'>): void {
  try {
    const data: OperationsChatHandoff = {
      ...payload,
      savedAt: new Date().toISOString(),
    };
    sessionStorage.setItem(OPERATIONS_CHAT_HANDOFF_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

export function peekOperationsChatHandoff(): OperationsChatHandoff | null {
  try {
    const raw = sessionStorage.getItem(OPERATIONS_CHAT_HANDOFF_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as OperationsChatHandoff;
    if (!o?.domain || !o?.row || typeof o.row !== 'object') return null;
    return o;
  } catch {
    return null;
  }
}

export function consumeOperationsChatHandoff(): OperationsChatHandoff | null {
  const v = peekOperationsChatHandoff();
  try {
    sessionStorage.removeItem(OPERATIONS_CHAT_HANDOFF_KEY);
  } catch {
    /* ignore */
  }
  return v;
}
