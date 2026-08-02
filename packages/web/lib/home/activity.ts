/**
 * "Velo handled N things" (UX-002).
 *
 * The product's core promise is that it is always on, and today that promise is
 * completely silent in the UI. This makes it visible — but only if it is true.
 *
 * Two decisions worth defending, because the obvious implementations are both
 * wrong:
 *
 * 1. **Count outcomes, not machinery.** `audit_trail` holds 244 rows, but the
 *    distribution is TOOL_PROPOSED 63 / TOOL_EXECUTED 63 / POLICY_DECISION 63 /
 *    AGENT_STARTED 27 / AGENT_COMPLETED 26. One user-visible action emits about
 *    five rows, so "244 things" would overstate reality by roughly 10x, in
 *    exactly the developer-console vocabulary EPIC B exists to delete.
 *    A completed agent run is the smallest unit a person would call "a thing".
 *
 * 2. **Skip the orchestrator.** It wraps the sub-agents that do the real work,
 *    so counting it double-counts every job.
 *
 * When nothing happened we return null rather than a zero. "Velo handled 0
 * things this week" is worse than silence — it actively undermines the promise.
 */
import { prisma } from '@/lib/prisma';

/** The orchestrator coordinates other agents; it is not itself a unit of work. */
const WRAPPER_AGENTS = new Set(['orchestrator', '']);

/** Rolling window. Not "since Monday" — that degenerates to nothing on a Monday. */
export const HANDLED_WINDOW_DAYS = 7;

/**
 * Agent id -> what a person would say it did.
 *
 * Anything unmapped is humanised from its id rather than dropped, so a new
 * agent shows up in the summary the day it ships instead of silently vanishing.
 */
const AREA_LABELS: Record<string, string> = {
  'ar-collections': 'chased overdue invoices',
  'ap-invoice': 'processed vendor bills',
  runway: 'checked your runway',
  payroll: 'ran payroll',
  compliance: 'tracked filings',
  'expense-policy': 'reviewed expenses',
  onboarding: 'moved onboarding along',
};

function areaLabel(agentId: string): string {
  const key = agentId.trim().toLowerCase();
  if (AREA_LABELS[key]) return AREA_LABELS[key];
  const words = key.replace(/[_-]+/g, ' ').trim();
  return words || 'background work';
}

export interface HandledArea {
  label: string;
  count: number;
}

export interface HandledSummary {
  /** Number of completed jobs in the window. Always >= 1. */
  count: number;
  windowDays: number;
  /** Ordered by volume — the expandable one-line detail. */
  areas: HandledArea[];
}

/**
 * What Velo got done on its own in the last `windowDays`.
 *
 * Returns null when there is nothing to report, which the caller should render
 * as nothing at all.
 */
export async function getHandledSummary(
  now: Date = new Date(),
  windowDays: number = HANDLED_WINDOW_DAYS
): Promise<HandledSummary | null> {
  const cutoff = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000).toISOString();

  // `timestamp` is a text column holding ISO-8601 UTC, which sorts
  // lexicographically in chronological order — so a string >= comparison is a
  // valid date filter here, and lets the database do the work.
  const rows = await prisma.auditTrailEntry.findMany({
    where: {
      actionType: 'AGENT_COMPLETED',
      timestamp: { gte: cutoff },
    },
    select: { agentId: true },
    take: 2000,
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const agent = row.agentId?.trim().toLowerCase() ?? '';
    if (WRAPPER_AGENTS.has(agent)) continue;
    counts.set(agent, (counts.get(agent) ?? 0) + 1);
  }

  let total = 0;
  for (const n of counts.values()) total += n;
  if (total === 0) return null;

  const areas = [...counts.entries()]
    .map(([agent, count]) => ({ label: areaLabel(agent), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

  return { count: total, windowDays, areas };
}
