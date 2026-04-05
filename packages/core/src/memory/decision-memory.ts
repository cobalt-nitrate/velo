// Phase 3 — lightweight repeat-decision hints (file-backed, no vector DB).

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getRepoRoot } from '../config/loader.js';

const SIGNATURE_KEYS = [
  'vendor_name',
  'client_name',
  'total_amount',
  'amount',
  'amount_inr',
  'invoice_number',
  'gstin',
  'invoice_id',
  'obligation_id',
  'approval_id',
  'txn_id',
  'run_id',
  'employee_id',
];

export interface DecisionMemoryEntry {
  ts: string;
  tool_id: string;
  signature: string;
  outcome: 'approved' | 'rejected' | 'auto_executed';
  actor_id?: string;
  notes?: string;
}

function storeFile(): string {
  const dir =
    process.env.VELO_STATE_DIR ?? join(getRepoRoot(), '.velo');
  return join(dir, 'decision-memory.json');
}

export function decisionSignature(
  toolId: string,
  parameters: Record<string, unknown>
): string {
  const o: Record<string, unknown> = { tool_id: toolId };
  for (const k of SIGNATURE_KEYS) {
    const v = parameters[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') {
      o[k] = v;
    }
  }
  return JSON.stringify(o, Object.keys(o).sort());
}

function readAll(): DecisionMemoryEntry[] {
  const f = storeFile();
  if (!existsSync(f)) return [];
  try {
    const parsed = JSON.parse(readFileSync(f, 'utf-8')) as unknown;
    return Array.isArray(parsed) ? (parsed as DecisionMemoryEntry[]) : [];
  } catch {
    return [];
  }
}

function flush(entries: DecisionMemoryEntry[]): void {
  try {
    const f = storeFile();
    const dir = dirname(f);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(f, JSON.stringify(entries, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

/** Boost 0–1 for historical_pattern / entity signals when past outcomes were positive. */
export function memoryBoostForTool(
  toolId: string,
  parameters: Record<string, unknown>
): number | undefined {
  const sig = decisionSignature(toolId, parameters);
  const entries = readAll();
  const wins = entries.filter(
    (e) =>
      e.signature === sig &&
      (e.outcome === 'approved' || e.outcome === 'auto_executed')
  );
  if (wins.length === 0) return undefined;
  return Math.min(0.93, 0.56 + 0.07 * wins.length);
}

export function appendDecisionMemory(
  input: Omit<DecisionMemoryEntry, 'ts' | 'signature'> & {
    parameters?: Record<string, unknown>;
    signature?: string;
  }
): DecisionMemoryEntry {
  const signature =
    input.signature ??
    decisionSignature(input.tool_id, input.parameters ?? {});
  const entry: DecisionMemoryEntry = {
    ts: new Date().toISOString(),
    tool_id: input.tool_id,
    signature,
    outcome: input.outcome,
    actor_id: input.actor_id,
    notes: input.notes,
  };
  const all = readAll();
  all.push(entry);
  // Cap file size
  const cap = 2000;
  const trimmed = all.length > cap ? all.slice(all.length - cap) : all;
  flush(trimmed);
  return entry;
}

export function listDecisionMemoryRecent(limit = 50): DecisionMemoryEntry[] {
  const all = readAll();
  return all.slice(-Math.max(1, Math.min(500, limit))).reverse();
}
