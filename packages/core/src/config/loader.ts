// ConfigLoader — loads and validates all JSON config files.
// Config is loaded once at startup and cached.
// Application code never imports JSON directly — always goes through this.

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Config root is always relative to the repo root
const CONFIG_ROOT = resolve(process.cwd(), 'configs');

type ConfigKey =
  | 'business/company_config'
  | 'business/tax_config'
  | 'business/expense_categories'
  | 'business/payroll_config'
  | 'business/leave_types'
  | 'business/compliance_calendar_rules'
  | 'business/employee_fields'
  | 'business/workflow_config'
  | 'business/onboarding_templates'
  | 'business/policy_templates'
  | 'policies/autopilot'
  | `agents/${string}`
  | `workflows/${string}`;

const cache = new Map<string, unknown>();

export function loadConfig<T = unknown>(key: ConfigKey): T {
  if (cache.has(key)) return cache.get(key) as T;

  const filePath = resolve(CONFIG_ROOT, `${key}.json`);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as T;
    cache.set(key, parsed);
    return parsed;
  } catch (err) {
    throw new Error(`Failed to load config "${key}" from ${filePath}: ${err}`);
  }
}

export function loadPrompt(promptFile: string): string {
  const filePath = resolve(process.cwd(), promptFile);
  return readFileSync(filePath, 'utf-8');
}

export function loadAgentConfig(agentId: string) {
  // Try main agents/ then sub-agents/
  try {
    return loadConfig(`agents/${agentId}` as ConfigKey);
  } catch {
    return loadConfig(`agents/sub-agents/${agentId}` as ConfigKey);
  }
}

// Clear cache (useful in tests)
export function clearConfigCache(): void {
  cache.clear();
}
