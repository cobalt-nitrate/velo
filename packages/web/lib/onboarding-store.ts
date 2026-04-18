import 'server-only';

import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs';
import { join } from 'path';
import { veloDataDir } from './velo-data-dir';

export type OnboardingStepKey = 'llm' | 'google' | 'slack' | 'roles' | 'seed';

export interface StepState {
  done: boolean;
  skipped?: boolean;
}

export interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  currentStep: number;
  /** Prevents concurrent bootstrap runs. */
  bootstrapInProgress: boolean;
  steps: Record<OnboardingStepKey, StepState>;
  sheetsBootstrapped: boolean;
  seedDataLoaded: boolean;
}

const STEP_DEFAULTS: Record<OnboardingStepKey, StepState> = {
  llm: { done: false },
  google: { done: false },
  slack: { done: false, skipped: false },
  roles: { done: false },
  seed: { done: false, skipped: false },
};

const DEFAULT_STATE: OnboardingState = {
  completed: false,
  completedAt: null,
  currentStep: 0,
  bootstrapInProgress: false,
  steps: { ...STEP_DEFAULTS },
  sheetsBootstrapped: false,
  seedDataLoaded: false,
};

function onboardingPath(): string {
  return join(veloDataDir(), 'onboarding.json');
}

export function getOnboardingState(): OnboardingState {
  const p = onboardingPath();
  if (!existsSync(p)) return structuredClone(DEFAULT_STATE);
  try {
    const raw = JSON.parse(readFileSync(p, 'utf-8')) as Partial<OnboardingState>;
    return {
      ...DEFAULT_STATE,
      ...raw,
      // Merge per-step state so new steps added later get their defaults
      steps: { ...STEP_DEFAULTS, ...(raw.steps ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

/**
 * Atomically patch and persist onboarding state.
 * Uses a temp-file + rename strategy to avoid partial writes on crash.
 */
export function patchOnboardingState(patch: Partial<OnboardingState>): OnboardingState {
  const current = getOnboardingState();
  const next: OnboardingState = {
    ...current,
    ...patch,
    steps: { ...current.steps, ...(patch.steps ?? {}) },
  };
  const p = onboardingPath();
  const tmp = `${p}.tmp.${process.pid}`;
  writeFileSync(tmp, JSON.stringify(next, null, 2), 'utf-8');
  renameSync(tmp, p); // atomic on POSIX; best-effort on Windows
  return next;
}

export function isOnboardingComplete(): boolean {
  return getOnboardingState().completed;
}
