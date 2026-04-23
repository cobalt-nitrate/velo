import 'server-only';
import { prisma } from './prisma';

export type OnboardingStepKey = 'llm' | 'google' | 'slack' | 'roles' | 'seed';

export interface StepState {
  done: boolean;
  skipped?: boolean;
}

export interface OnboardingState {
  completed: boolean;
  completedAt: string | null;
  currentStep: number;
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

function fromDb(row: {
  completed: boolean;
  completedAt: Date | null;
  currentStep: number;
  bootstrapInProgress: boolean;
  steps: unknown;
  sheetsBootstrapped: boolean;
  seedDataLoaded: boolean;
}): OnboardingState {
  return {
    completed: row.completed,
    completedAt: row.completedAt?.toISOString() ?? null,
    currentStep: row.currentStep,
    bootstrapInProgress: row.bootstrapInProgress,
    steps: { ...STEP_DEFAULTS, ...(row.steps as Partial<OnboardingState['steps']>) },
    sheetsBootstrapped: row.sheetsBootstrapped,
    seedDataLoaded: row.seedDataLoaded,
  };
}

// Single-row table — always use the fixed singleton ID
const SINGLETON_ID = 'singleton';

export async function getOnboardingState(): Promise<OnboardingState> {
  const row = await prisma.onboardingState.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return fromDb(row);
}

type OnboardingPatch = Partial<Omit<OnboardingState, 'steps'>> & {
  steps?: Partial<OnboardingState['steps']>;
};

export async function patchOnboardingState(patch: OnboardingPatch): Promise<OnboardingState> {
  const current = await getOnboardingState();
  const mergedSteps = patch.steps
    ? { ...current.steps, ...patch.steps }
    : current.steps;

  const updated = await prisma.onboardingState.update({
    where: { id: SINGLETON_ID },
    data: {
      ...(typeof patch.completed === 'boolean' && { completed: patch.completed }),
      ...(patch.completed === true && { completedAt: new Date() }),
      ...(typeof patch.currentStep === 'number' && {
        currentStep: Math.max(0, Math.min(4, Math.trunc(patch.currentStep))),
      }),
      ...(typeof patch.bootstrapInProgress === 'boolean' && {
        bootstrapInProgress: patch.bootstrapInProgress,
      }),
      ...(typeof patch.sheetsBootstrapped === 'boolean' && {
        sheetsBootstrapped: patch.sheetsBootstrapped,
      }),
      ...(typeof patch.seedDataLoaded === 'boolean' && {
        seedDataLoaded: patch.seedDataLoaded,
      }),
      steps: mergedSteps as object,
    },
  });
  return fromDb(updated);
}

export async function isOnboardingComplete(): Promise<boolean> {
  const row = await prisma.onboardingState.findUnique({
    where: { id: SINGLETON_ID },
    select: { completed: true },
  });
  return row?.completed ?? false;
}
