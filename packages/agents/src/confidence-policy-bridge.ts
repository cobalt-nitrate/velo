/**
 * Deterministic confidence caps before PolicyEngine evaluation.
 * Cap values load from configs/policies/confidence_risk_caps.json (Phase 3).
 */

import { loadConfig } from '@velo/core/config';
import { canonicalVeloDataToolId } from '@velo/core';

function riskCaps(): { high: number; filing: number } {
  try {
    const c = loadConfig('policies/confidence_risk_caps') as {
      high_value_write_cap?: number;
      filing_action_cap?: number;
    };
    return {
      high: c.high_value_write_cap ?? 0.72,
      filing: c.filing_action_cap ?? 0.68,
    };
  } catch {
    return { high: 0.72, filing: 0.68 };
  }
}

export function adjustConfidenceForPolicyRisk(params: {
  baseConfidence: number;
  toolId: string;
  amountInr?: number;
  paymentAutoThresholdInr: number;
  isFilingAction: boolean;
}): { adjusted: number; notes: string[] } {
  let c = params.baseConfidence;
  const notes: string[] = [];
  const caps = riskCaps();
  const canonId = canonicalVeloDataToolId(params.toolId);
  const isWrite =
    canonId.startsWith('data.') &&
    !/\.(get_|lookup|find_|list)/.test(canonId) &&
    !canonId.includes('.get_');

  const highValue =
    typeof params.amountInr === 'number' &&
    Number.isFinite(params.amountInr) &&
    params.amountInr >= params.paymentAutoThresholdInr;

  if (isWrite && highValue) {
    c = Math.min(c, caps.high);
    notes.push('amount>=payment_auto_threshold_inr');
  }
  if (params.isFilingAction && isWrite) {
    c = Math.min(c, caps.filing);
    notes.push('filing_or_statutory_action');
  }

  return { adjusted: Math.round(Math.max(0, Math.min(1, c)) * 100) / 100, notes };
}
