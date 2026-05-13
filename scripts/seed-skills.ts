// Seed known skills into skill-cache.json with success_count=5 so they're
// immediately eligible for cache hits. Idempotent: skips existing skill_ids.
// Usage: npx tsx scripts/seed-skills.ts

import { upsertSkill } from '../packages/agents/src/skill-cache.js';
import type { Skill } from '../packages/agents/src/skill-cache.js';

const SEEDS: Skill[] = [
  {
    skill_id: 'runway_hiring_sim',
    agent_id: 'runway',
    intent_patterns: ['hire', 'afford', 'headcount', 'sde', 'engineer', 'salary', 'cost', 'bring', 'joining'],
    tool_sequence: [{ tool_id: 'data.runway.get_snapshot', params: {} }],
    success_count: 5,
    fail_count: 0,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    skill_id: 'runway_check',
    agent_id: 'runway',
    intent_patterns: ['runway', 'burn', 'cash', 'months', 'long', 'fund', 'balance', 'survive'],
    tool_sequence: [{ tool_id: 'data.runway.get_snapshot', params: {} }],
    success_count: 5,
    fail_count: 0,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    skill_id: 'compliance_check',
    agent_id: 'compliance',
    intent_patterns: ['filing', 'gstr', 'tds', 'pf', 'esic', 'compliance', 'deadline', 'obligation', 'pending'],
    tool_sequence: [{ tool_id: 'data.compliance_calendar.get_upcoming_obligations', params: {} }],
    success_count: 5,
    fail_count: 0,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    skill_id: 'payroll_status',
    agent_id: 'payroll',
    intent_patterns: ['payroll', 'salary', 'salaries', 'paid', 'payslip', 'take', 'home', 'disburse'],
    tool_sequence: [
      { tool_id: 'data.payroll_runs.get_committed_salaries', params: {} },
      { tool_id: 'data.employees.get_active', params: {} },
    ],
    success_count: 5,
    fail_count: 0,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
  {
    skill_id: 'platform_health',
    agent_id: 'orchestrator',
    intent_patterns: ['health', 'status', 'attention', 'pending', 'overview', 'snapshot', 'missing', 'approval'],
    tool_sequence: [{ tool_id: 'internal.platform.healthcheck', params: {} }],
    success_count: 5,
    fail_count: 0,
    last_used_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  },
];

for (const skill of SEEDS) {
  upsertSkill(skill);
  console.log(`Seeded: ${skill.skill_id}`);
}
console.log('Done. Skill cache seeded.');
