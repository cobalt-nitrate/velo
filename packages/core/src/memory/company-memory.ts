// Lightweight per-company memory: last-known financials injected into context.memory
// so sub-agents don't re-fetch what was already retrieved this session.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getRepoRoot } from '../config/loader.js';
import type { Observation } from '../types/agent.js';

export interface CompanyMemoryRecord {
  company_id: string;
  bank_balance: number | null;
  runway_months: number | null;
  headcount: number | null;
  pending_approvals: number;
  last_updated: string;
  snapshot_json: string;
}

type MemoryStore = Record<string, CompanyMemoryRecord>;

function storeFile(): string {
  const dir = process.env.VELO_STATE_DIR ?? join(getRepoRoot(), '.velo');
  return join(dir, 'company-memory.json');
}

function readStore(): MemoryStore {
  const f = storeFile();
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, 'utf-8')) as MemoryStore;
  } catch {
    return {};
  }
}

function flushStore(store: MemoryStore): void {
  try {
    const f = storeFile();
    const dir = dirname(f);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(f, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

export function getCompanyMemory(companyId: string): CompanyMemoryRecord | null {
  const store = readStore();
  return store[companyId] ?? null;
}

export function upsertCompanyMemory(
  companyId: string,
  patch: Partial<Omit<CompanyMemoryRecord, 'company_id'>>
): void {
  const store = readStore();
  const existing = store[companyId] ?? {
    company_id: companyId,
    bank_balance: null,
    runway_months: null,
    headcount: null,
    pending_approvals: 0,
    last_updated: '',
    snapshot_json: '',
  };
  store[companyId] = {
    ...existing,
    ...patch,
    company_id: companyId,
    last_updated: new Date().toISOString(),
  };
  flushStore(store);
}

/** Extract memory-worthy facts from tool observations collected during a run. */
export function extractMemoryFromObservations(
  observations: Observation[]
): Partial<Omit<CompanyMemoryRecord, 'company_id'>> {
  const patch: Partial<Omit<CompanyMemoryRecord, 'company_id'>> = {};

  for (const obs of observations) {
    const out = obs.output as Record<string, unknown> | null | undefined;
    if (!out) continue;

    // runway snapshot
    if (obs.tool_id === 'data.runway.get_snapshot') {
      const bb = out.bank_balance as Record<string, unknown> | null | undefined;
      const rows = bb?.rows as Array<Record<string, unknown>> | undefined;
      if (rows?.[0]?.balance !== undefined) {
        patch.bank_balance = Number(rows[0].balance);
      }
      const emp = out.employees as Record<string, unknown> | null | undefined;
      const empRows = emp?.rows as unknown[] | undefined;
      if (empRows) patch.headcount = empRows.length;
    }

    // healthcheck snapshot
    if (obs.tool_id === 'internal.platform.healthcheck') {
      const snap = out.operational_snapshot as Record<string, unknown> | null | undefined;
      if (snap) {
        const pa = snap.pending_approvals as unknown[] | undefined;
        if (pa) patch.pending_approvals = pa.length;
        patch.snapshot_json = JSON.stringify(snap).slice(0, 8000);
        const ae = snap.active_employees as number | undefined;
        if (typeof ae === 'number') patch.headcount = ae;
      }
    }

    // bank balance direct
    if (obs.tool_id === 'data.bank_transactions.get_latest_balance') {
      const rows = (out.rows as Array<Record<string, unknown>>) ?? [];
      if (rows[0]?.balance !== undefined) {
        patch.bank_balance = Number(rows[0].balance);
      }
    }

    // runway result from runway agent (parsed from output text)
    if (obs.tool_id === 'data.runway.get_snapshot' && out.runway_months !== undefined) {
      patch.runway_months = Number(out.runway_months);
    }
  }

  return patch;
}
