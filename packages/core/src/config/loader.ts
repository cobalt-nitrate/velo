// ConfigLoader — loads and validates all JSON config files.
// Config is loaded once at startup and cached.
// Application code never imports JSON directly — always goes through this.

import { existsSync, readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { z } from 'zod';

function findRepoRoot(): string {
  let dir = resolve(process.cwd());
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, 'configs', 'policies', 'autopilot.json'))) {
      return dir;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return resolve(process.cwd());
}

const REPO_ROOT = findRepoRoot();
const CONFIG_ROOT = resolve(REPO_ROOT, 'configs');

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

const agentConfigSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    model: z.string(),
    system_prompt_file: z.string(),
    sub_agents: z.array(z.string()),
    tools: z.array(z.string()),
    confidence_thresholds: z.object({
      auto_execute: z.number(),
      request_approval: z.number(),
      recommend_only: z.number(),
      refuse: z.number(),
    }),
    max_iterations: z.number().int().positive(),
    timeout_seconds: z.number().int().positive(),
  })
  .passthrough();

const autopilotPolicySchema = z
  .object({
    payment_auto_threshold_inr: z.number(),
    filing_auto_execute: z.boolean(),
    alerts_mode: z.string().optional(),
    confidence_thresholds: z.object({
      auto_execute_min: z.number(),
      request_approval_min: z.number(),
      recommend_only_min: z.number(),
      refuse_below: z.number(),
    }),
    action_overrides: z.array(
      z.object({
        action_type: z.string(),
        policy: z.enum(['NEVER_AUTO_EXECUTE', 'REQUEST_APPROVAL', 'AUTO_EXECUTE']),
        reason: z.string().optional(),
      })
    ),
    rbac: z.record(z.array(z.string())),
  })
  .passthrough();

const workflowSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string().optional(),
  trigger: z.string(),
  required_params: z.array(z.string()).optional(),
  steps: z.array(z.record(z.unknown())),
});

export function loadConfig<T = unknown>(key: ConfigKey): T {
  if (cache.has(key)) return cache.get(key) as T;

  const filePath = resolve(CONFIG_ROOT, `${key}.json`);
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw);
    const validated = validateConfig(key, parsed) as T;
    cache.set(key, validated);
    return validated;
  } catch (err) {
    throw new Error(`Failed to load config "${key}" from ${filePath}: ${err}`);
  }
}

export function loadPrompt(promptFile: string): string {
  const filePath = resolve(REPO_ROOT, promptFile);
  return readFileSync(filePath, 'utf-8');
}

export function getRepoRoot(): string {
  return REPO_ROOT;
}

export function loadAgentConfig(agentId: string) {
  // Try main agents/ then sub-agents/
  try {
    return loadConfig(`agents/${agentId}` as ConfigKey);
  } catch {
    return loadConfig(`agents/sub-agents/${agentId}` as ConfigKey);
  }
}

function validateConfig(key: string, value: unknown): unknown {
  if (key.startsWith('agents/')) {
    return agentConfigSchema.parse(value);
  }
  if (key === 'policies/autopilot') {
    return autopilotPolicySchema.parse(sanitizeAutopilot(value));
  }
  if (key.startsWith('workflows/')) {
    return workflowSchema.parse(value);
  }
  return value;
}

function sanitizeAutopilot(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) delete obj[k];
  }
  const rbac = obj.rbac;
  if (rbac && typeof rbac === 'object') {
    obj.rbac = Object.fromEntries(
      Object.entries(rbac as Record<string, unknown>).filter(
        ([roleKey]) => !roleKey.startsWith('_')
      )
    );
  }
  return obj;
}

// Clear cache (useful in tests)
export function clearConfigCache(): void {
  cache.clear();
}
