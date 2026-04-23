import type { ConfidenceSignals } from '@velo/core/confidence';
import { loadConfig } from '@velo/core/config';
import { canonicalVeloDataToolId, memoryBoostForTool } from '@velo/core';

/** Maps tool ids to fields used for extraction completeness scoring. */
export function scoringSignalsForTool(
  toolId: string,
  parameters: Record<string, unknown>
): ConfidenceSignals {
  const mem = memoryBoostForTool(toolId, parameters);
  const paramHist = numberOrUndef(parameters.historical_match_confidence);
  return {
    required_fields: requiredFieldsForTool(toolId),
    extracted_fields: parameters,
    entity_match_confidence: numberOrUndef(parameters.entity_match_confidence),
    category_match_confidence: numberOrUndef(parameters.category_match_confidence),
    historical_match_confidence: paramHist ?? mem,
    data_age_hours: numberOrUndef(parameters.data_age_hours),
  };
}

function numberOrUndef(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function requiredFieldsFromConfig(toolId: string): string[] | undefined {
  try {
    const cfg = loadConfig('business/confidence_signals') as {
      tool_required_fields?: Record<string, string[]>;
    };
    const list = cfg.tool_required_fields?.[toolId];
    return list?.length ? list : undefined;
  } catch {
    return undefined;
  }
}

export function requiredFieldsForTool(toolId: string): string[] {
  const fromCfg = requiredFieldsFromConfig(toolId);
  if (fromCfg) return fromCfg;
  return requiredFieldsForToolCodeFallback(toolId);
}

function requiredFieldsForToolCodeFallback(toolId: string): string[] {
  const canon = canonicalVeloDataToolId(toolId);
  if (toolId === 'internal.sub_agent.invoke') {
    return ['sub_agent_id', 'input'];
  }
  if (toolId === 'internal.platform.healthcheck') {
    return [];
  }

  const isRead =
    /\.(get_|lookup|find_|list)/.test(canon) ||
    canon.includes('.get_active') ||
    canon.includes('get_recent') ||
    canon.includes('get_pending') ||
    canon.includes('get_latest') ||
    canon.includes('get_by_date') ||
    canon.includes('get_ytd') ||
    canon.includes('get_blockers') ||
    canon.includes('get_committed') ||
    canon.includes('get_outstanding') ||
    canon.includes('get_overdue');
  if (canon.startsWith('sheets.') && isRead) {
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
    canon.startsWith('sheets.ap_invoices') &&
    canon.includes('.create')
  ) {
    return ['vendor_name', 'total_amount', 'invoice_date'];
  }
  if (
    canon.startsWith('sheets.ar_invoices') &&
    canon.includes('.create')
  ) {
    return ['client_name', 'total_amount', 'invoice_date'];
  }
  if (canon.startsWith('sheets.payroll_runs') && canon.includes('create')) {
    return ['month', 'year'];
  }
  if (toolId.startsWith('email.')) {
    return ['to'];
  }

  if (canon.startsWith('sheets.') && canon.includes('.create')) {
    return ['company_id'];
  }

  return [];
}
