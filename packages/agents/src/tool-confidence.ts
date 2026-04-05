import type { ConfidenceSignals } from '@velo/core/confidence';

/** Maps tool ids to fields used for extraction completeness scoring. */
export function scoringSignalsForTool(
  toolId: string,
  parameters: Record<string, unknown>
): ConfidenceSignals {
  return {
    required_fields: requiredFieldsForTool(toolId),
    extracted_fields: parameters,
    entity_match_confidence: numberOrUndef(
      parameters.entity_match_confidence
    ),
    category_match_confidence: numberOrUndef(
      parameters.category_match_confidence
    ),
    historical_match_confidence: numberOrUndef(
      parameters.historical_match_confidence
    ),
    data_age_hours: numberOrUndef(parameters.data_age_hours),
  };
}

function numberOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function requiredFieldsForTool(toolId: string): string[] {
  if (toolId === 'internal.sub_agent.invoke') {
    return ['sub_agent_id', 'input'];
  }
  if (toolId === 'internal.platform.healthcheck') {
    return [];
  }

  const isRead =
    /\.(get_|lookup|find_|list)/.test(toolId) ||
    toolId.includes('.get_active') ||
    toolId.includes('get_recent') ||
    toolId.includes('get_pending') ||
    toolId.includes('get_latest') ||
    toolId.includes('get_by_date') ||
    toolId.includes('get_ytd') ||
    toolId.includes('get_blockers') ||
    toolId.includes('get_committed') ||
    toolId.includes('get_outstanding') ||
    toolId.includes('get_overdue');
  if (toolId.startsWith('sheets.') && isRead) {
    return [];
  }

  if (toolId.startsWith('notifications.')) return [];
  if (toolId.startsWith('bank.statement')) {
    return [];
  }
  if (toolId.startsWith('ocr.')) {
    return [];
  }

  if (
    toolId.startsWith('sheets.ap_invoices') &&
    toolId.includes('.create')
  ) {
    return ['vendor_name', 'total_amount', 'invoice_date'];
  }
  if (
    toolId.startsWith('sheets.ar_invoices') &&
    toolId.includes('.create')
  ) {
    return ['client_name', 'total_amount', 'invoice_date'];
  }
  if (toolId.startsWith('sheets.payroll_runs') && toolId.includes('create')) {
    return ['month', 'year'];
  }
  if (toolId.startsWith('email.')) {
    return ['to'];
  }

  if (toolId.startsWith('sheets.') && toolId.includes('.create')) {
    return ['company_id'];
  }

  return [];
}
