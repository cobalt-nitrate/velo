// Skill cache: maps intent patterns → deterministic tool sequences.
// On a cache hit the tools run directly and only one LLM call is made for synthesis.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { getRepoRoot } from '@velo/core/config';
import type { AgentContext, Observation } from '@velo/core/types';

export interface SkillToolCall {
  tool_id: string;
  params: Record<string, unknown>;
}

export interface Skill {
  skill_id: string;
  agent_id: string;
  intent_patterns: string[];
  tool_sequence: SkillToolCall[];
  success_count: number;
  fail_count: number;
  last_used_at: string;
  created_at: string;
}

type SkillStore = Record<string, Skill>;

function storeFile(): string {
  const dir = process.env.VELO_STATE_DIR ?? join(getRepoRoot(), '.velo');
  return join(dir, 'skill-cache.json');
}

function readStore(): SkillStore {
  const f = storeFile();
  if (!existsSync(f)) return {};
  try {
    return JSON.parse(readFileSync(f, 'utf-8')) as SkillStore;
  } catch {
    return {};
  }
}

function flushStore(store: SkillStore): void {
  try {
    const f = storeFile();
    const dir = dirname(f);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(f, JSON.stringify(store, null, 2), 'utf-8');
  } catch {
    /* best-effort */
  }
}

/** Returns best matching skill for the user input, or null if no match. */
export function matchSkill(input: string): Skill | null {
  const lower = input.toLowerCase();
  const store = readStore();
  let best: Skill | null = null;
  let bestScore = 0;

  for (const skill of Object.values(store)) {
    if (skill.success_count < 3) continue;
    let score = 0;
    for (const pattern of skill.intent_patterns) {
      if (lower.includes(pattern.toLowerCase())) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      best = skill;
    }
  }

  return bestScore > 0 ? best : null;
}

/** Record a skill after a completed run. Extracts tool sequence from observations. */
export function recordSkill(
  agentId: string,
  input: string,
  observations: Observation[],
  success: boolean
): void {
  const store = readStore();

  const toolSequence: SkillToolCall[] = observations
    .filter(
      (o) =>
        !o.tool_id.startsWith('internal.sub_agent') &&
        o.tool_id !== 'internal.platform.healthcheck'
    )
    .map((o) => ({ tool_id: o.tool_id, params: {} }));

  if (toolSequence.length === 0) return;

  const lower = input.toLowerCase();
  const words = lower
    .split(/\W+/)
    .filter((w) => w.length > 3)
    .slice(0, 10);

  // Look for existing skill with same agent + overlapping tool sequence
  const matchKey = `${agentId}:${toolSequence.map((t) => t.tool_id).join(',')}`;
  const existingId = Object.keys(store).find((id) => {
    const s = store[id];
    return (
      s.agent_id === agentId &&
      s.tool_sequence.map((t) => t.tool_id).join(',') === toolSequence.map((t) => t.tool_id).join(',')
    );
  });

  if (existingId) {
    const s = store[existingId];
    // Merge any new patterns
    const merged = Array.from(new Set([...s.intent_patterns, ...words])).slice(0, 20);
    store[existingId] = {
      ...s,
      intent_patterns: merged,
      success_count: success ? s.success_count + 1 : s.success_count,
      fail_count: success ? s.fail_count : s.fail_count + 1,
      last_used_at: new Date().toISOString(),
    };
  } else {
    const skill_id = `auto_${agentId}_${Date.now()}`;
    store[skill_id] = {
      skill_id,
      agent_id: agentId,
      intent_patterns: words,
      tool_sequence: toolSequence,
      success_count: success ? 1 : 0,
      fail_count: success ? 0 : 1,
      last_used_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    };
    void matchKey; // suppress unused warning
  }

  flushStore(store);
}

/** Upsert a skill directly (used by seed script). */
export function upsertSkill(skill: Skill): void {
  const store = readStore();
  store[skill.skill_id] = skill;
  flushStore(store);
}

type ToolExecutorFn = (params: Record<string, unknown>) => Promise<unknown>;

/**
 * Execute a skill's tool sequence directly, then return tool results for LLM synthesis.
 * The caller is responsible for one final LLM call to synthesize the results.
 */
export async function executeSkillTools(
  skill: Skill,
  context: AgentContext,
  toolRegistry: Map<string, ToolExecutorFn>
): Promise<{ observations: Observation[]; success: boolean }> {
  const observations: Observation[] = [];

  for (const step of skill.tool_sequence) {
    const tool = toolRegistry.get(step.tool_id);
    if (!tool) continue;
    try {
      const output = await tool({
        ...step.params,
        company_id: context.company_id,
        tool_id: step.tool_id,
      });
      observations.push({
        tool_id: step.tool_id,
        input: step.params,
        output,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      observations.push({
        tool_id: step.tool_id,
        input: step.params,
        output: { ok: false, error: String(err) },
        timestamp: new Date().toISOString(),
      });
      return { observations, success: false };
    }
  }

  // Update usage stats
  const store = readStore();
  if (store[skill.skill_id]) {
    store[skill.skill_id].last_used_at = new Date().toISOString();
    flushStore(store);
  }

  return { observations, success: true };
}
