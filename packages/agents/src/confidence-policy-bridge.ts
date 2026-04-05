/**
 * Wave 1 — deterministic confidence caps before PolicyEngine evaluation.
 * Replace with calibrated models later; connectors can supply richer signals via tool params.
 */

export function adjustConfidenceForPolicyRisk(params: {
  baseConfidence: number;
  toolId: string;
  amountInr?: number;
  paymentAutoThresholdInr: number;
  isFilingAction: boolean;
}): { adjusted: number; notes: string[] } {
  let c = params.baseConfidence;
  const notes: string[] = [];
  const isWrite =
    params.toolId.startsWith('sheets.') &&
    !/\.(get_|lookup|find_|list)/.test(params.toolId) &&
    !params.toolId.includes('.get_');

  const highValue =
    typeof params.amountInr === 'number' &&
    Number.isFinite(params.amountInr) &&
    params.amountInr >= params.paymentAutoThresholdInr;

  if (isWrite && highValue) {
    c = Math.min(c, 0.72);
    notes.push('amount>=payment_auto_threshold_inr');
  }
  if (params.isFilingAction && isWrite) {
    c = Math.min(c, 0.68);
    notes.push('filing_or_statutory_action');
  }

  return { adjusted: Math.round(Math.max(0, Math.min(1, c)) * 100) / 100, notes };
}
