/**
 * "What happens if I ignore this?" — deterministic only.
 *
 * Deliberately never LLM-generated: the answer must be identical every render,
 * and for statutory items it is close to financial advice.
 *
 * Order of preference:
 *   1. A reason the agent already wrote into the approval payload
 *   2. A static statutory penalty rule
 *   3. Nothing — better silent than invented
 */

/**
 * Indicative statutory consequences, keyed by compliance_calendar.type.
 *
 * These are standard Indian rates as a founder would recognise them, not a
 * computed liability. Keep them coarse and keep them here — one table to
 * correct when rules change.
 */
const STATUTORY_PENALTY: Record<string, string> = {
  'GSTR-1': '₹50/day late fee, capped at ₹5,000',
  'GSTR-3B': '₹50/day late fee plus 18% p.a. interest on tax due',
  GSTR9: '₹200/day late fee',
  TDS: '1.5% per month interest on late deposit, plus ₹200/day filing fee',
  PF: '12% p.a. interest plus damages on late ECR deposit',
  ESIC: '12% p.a. interest on late contribution',
  PT: 'State-specified interest and penalty on late payment',
};

/** Normalise "gstr_3b", "GSTR 3B", "gstr-3b" → "GSTR-3B". */
function normaliseType(type: string): string {
  return type.trim().toUpperCase().replace(/[\s_]+/g, '-');
}

/** Statutory consequence for a compliance row, or null if the type is unknown. */
export function complianceConsequence(type: string): string | null {
  const key = normaliseType(type);
  return STATUTORY_PENALTY[key] ?? STATUTORY_PENALTY[key.replace(/-/g, '')] ?? null;
}

/**
 * The agent frequently writes a plain-English reason into action_payload_json
 * (e.g. "Pay Zoom before service suspension"). That is already the consequence —
 * the previous UI simply discarded it.
 */
export function approvalConsequence(payloadJson: string): string | null {
  let payload: unknown;
  try {
    payload = JSON.parse(payloadJson || '{}');
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  const reason = (payload as Record<string, unknown>).reason;

  return typeof reason === 'string' && reason.trim() ? reason.trim() : null;
}

/** Read a numeric field out of an approval payload (amount_inr and friends). */
export function approvalPayloadNumber(payloadJson: string, key: string): number | null {
  try {
    const payload = JSON.parse(payloadJson || '{}') as Record<string, unknown>;
    const v = payload?.[key];
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
      const n = Number(v.replace(/[₹,\s]/g, ''));
      return Number.isFinite(n) ? n : null;
    }
  } catch {
    /* malformed payload — treat as absent */
  }
  return null;
}
