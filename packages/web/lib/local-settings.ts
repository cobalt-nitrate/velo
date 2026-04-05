import { existsSync, readFileSync, writeFileSync } from 'fs';
import { settingsPath } from './chat-store';

export interface UiSettings {
  companyName: string;
  defaultAgentId: string;
  defaultCurrency: string;
  /** e.g. founder | finance_lead */
  defaultActorRole: string;
}

const DEFAULTS: UiSettings = {
  companyName: 'Your company',
  defaultAgentId: 'orchestrator',
  defaultCurrency: 'INR',
  defaultActorRole: 'founder',
};

export function getUiSettings(): UiSettings {
  const p = settingsPath();
  if (!existsSync(p)) return { ...DEFAULTS };
  try {
    return { ...DEFAULTS, ...JSON.parse(readFileSync(p, 'utf-8')) };
  } catch {
    return { ...DEFAULTS };
  }
}

export function setUiSettings(patch: Partial<UiSettings>): UiSettings {
  const next = { ...getUiSettings(), ...patch };
  writeFileSync(settingsPath(), JSON.stringify(next, null, 2), 'utf-8');
  return next;
}
