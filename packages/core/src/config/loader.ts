// ConfigLoader — loads and validates all JSON config files.
// Config is loaded once at startup and cached.
// Application code never imports JSON directly — always goes through this.

import { existsSync, readdirSync, readFileSync } from 'fs';
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
  | 'business/confidence_signals'
  | 'policies/autopilot'
  | 'policies/confidence_weights'
  | 'policies/confidence_risk_caps'
  | `agents/${string}`
  | `workflows/${string}`;

const cache = new Map<string, unknown>();

const confidenceThresholdsSchema = z.object({
  auto_execute: z.number(),
  request_approval: z.number(),
  recommend_only: z.number(),
  refuse: z.number(),
});

const agentConfigSchema = z
  .object({
    id: z.string(),
    label: z.string(),
    description: z.string(),
    model: z.string(),
    system_prompt_file: z.string(),
    sub_agents: z.array(z.string()),
    tools: z.array(z.string()),
    confidence_thresholds: confidenceThresholdsSchema,
    max_iterations: z.number().int().positive(),
    timeout_seconds: z.number().int().positive(),
  })
  .passthrough();

/** Sub-agents use the same shape but often omit thresholds (inherited at orchestration time). */
const subAgentConfigSchema = agentConfigSchema
  .omit({ confidence_thresholds: true })
  .extend({ confidence_thresholds: confidenceThresholdsSchema.optional() })
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

/** Business JSON under configs/business — structure-checked, unknown keys allowed. */
const companyConfigSchema = z
  .object({
    company_name: z.string().min(1),
    gstin: z.string().min(1),
    pan: z.string().min(1),
    state_code: z.string().min(1),
    currency: z.string().min(1),
  })
  .passthrough();

const workflowConfigSchema = z
  .object({
    approval_rules: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const expenseCategoriesSchema = z
  .object({
    categories: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const taxConfigSchema = z
  .object({
    pf: z.record(z.unknown()),
  })
  .passthrough();

const payrollConfigSchema = z
  .object({
    salary_components: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const leaveTypesBusinessSchema = z
  .object({
    leave_types: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const complianceCalendarRulesSchema = z
  .object({
    rules: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const employeeFieldsSchema = z
  .object({
    fields: z.array(z.record(z.unknown())).min(1),
  })
  .passthrough();

const confidenceSignalsSchema = z
  .object({
    tool_required_fields: z.record(z.array(z.string())),
  })
  .passthrough();

const confidenceWeightsSchema = z
  .object({
    extraction_completeness: z.number(),
    entity_match_quality: z.number(),
    category_match_quality: z.number(),
    historical_pattern_match: z.number(),
    data_freshness: z.number(),
  })
  .passthrough();

const confidenceRiskCapsSchema = z
  .object({
    high_value_write_cap: z.number(),
    filing_action_cap: z.number(),
  })
  .passthrough();

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
    if (key.includes('/sub-agents/')) {
      return subAgentConfigSchema.parse(value);
    }
    return agentConfigSchema.parse(value);
  }
  if (key === 'policies/autopilot') {
    return autopilotPolicySchema.parse(sanitizeAutopilot(value));
  }
  if (key === 'policies/confidence_weights') {
    return confidenceWeightsSchema.parse(sanitizeUnderscoreKeys(value));
  }
  if (key === 'policies/confidence_risk_caps') {
    return confidenceRiskCapsSchema.parse(sanitizeUnderscoreKeys(value));
  }
  if (key.startsWith('workflows/')) {
    return workflowSchema.parse(value);
  }
  if (key === 'business/company_config') {
    return companyConfigSchema.parse(value);
  }
  if (key === 'business/workflow_config') {
    return workflowConfigSchema.parse(value);
  }
  if (key === 'business/expense_categories') {
    return expenseCategoriesSchema.parse(value);
  }
  if (key === 'business/tax_config') {
    return taxConfigSchema.parse(value);
  }
  if (key === 'business/payroll_config') {
    return payrollConfigSchema.parse(value);
  }
  if (key === 'business/leave_types') {
    return leaveTypesBusinessSchema.parse(value);
  }
  if (key === 'business/compliance_calendar_rules') {
    return complianceCalendarRulesSchema.parse(value);
  }
  if (key === 'business/employee_fields') {
    return employeeFieldsSchema.parse(value);
  }
  if (key === 'business/confidence_signals') {
    return confidenceSignalsSchema.parse(sanitizeUnderscoreKeys(value));
  }
  return value;
}

function sanitizeUnderscoreKeys(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const obj = { ...(raw as Record<string, unknown>) };
  for (const k of Object.keys(obj)) {
    if (k.startsWith('_')) delete obj[k];
  }
  return obj;
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

/**
 * Validate every configs/business/*.json, policies/autopilot.json, workflows/*.json,
 * and agents (including sub-agents) without polluting the loadConfig cache.
 * Use in CI and `pnpm validate-configs`.
 */
export function validateAllVeloConfigs(): { ok: boolean; errors: string[] } {
  const errors: string[] = [];

  const businessDir = resolve(CONFIG_ROOT, 'business');
  if (existsSync(businessDir)) {
    for (const name of readdirSync(businessDir)) {
      if (!name.endsWith('.json')) continue;
      const key = `business/${name.replace(/\.json$/, '')}` as ConfigKey;
      try {
        const filePath = resolve(businessDir, name);
        const parsed = JSON.parse(readFileSync(filePath, 'utf-8'));
        validateConfig(key, parsed);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const policiesDir = resolve(CONFIG_ROOT, 'policies');
  if (existsSync(policiesDir)) {
    for (const name of readdirSync(policiesDir)) {
      if (!name.endsWith('.json')) continue;
      const base = name.replace(/\.json$/, '');
      const key = `policies/${base}` as ConfigKey;
      try {
        const parsed = JSON.parse(
          readFileSync(resolve(policiesDir, name), 'utf-8')
        );
        validateConfig(key, parsed);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const workflowsDir = resolve(CONFIG_ROOT, 'workflows');
  if (existsSync(workflowsDir)) {
    for (const name of readdirSync(workflowsDir)) {
      if (!name.endsWith('.json')) continue;
      const key = `workflows/${name.replace(/\.json$/, '')}` as ConfigKey;
      try {
        const parsed = JSON.parse(readFileSync(resolve(workflowsDir, name), 'utf-8'));
        validateConfig(key, parsed);
      } catch (e) {
        errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const agentsDir = resolve(CONFIG_ROOT, 'agents');
  const validateAgentFile = (subdir: string, name: string) => {
    const rel = subdir ? `agents/${subdir}/${name.replace(/\.json$/, '')}` : `agents/${name.replace(/\.json$/, '')}`;
    const key = rel as ConfigKey;
    try {
      const base = subdir ? resolve(agentsDir, subdir) : agentsDir;
      const parsed = JSON.parse(readFileSync(resolve(base, name), 'utf-8'));
      validateConfig(key, parsed);
    } catch (e) {
      errors.push(`${key}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (existsSync(agentsDir)) {
    for (const name of readdirSync(agentsDir)) {
      if (!name.endsWith('.json')) continue;
      validateAgentFile('', name);
    }
    const sub = resolve(agentsDir, 'sub-agents');
    if (existsSync(sub)) {
      for (const name of readdirSync(sub)) {
        if (!name.endsWith('.json')) continue;
        validateAgentFile('sub-agents', name);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}
