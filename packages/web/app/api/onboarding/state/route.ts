import { authOptions } from '@/lib/auth';
import {
  getOnboardingState,
  patchOnboardingState,
  type OnboardingState,
} from '@/lib/onboarding-store';
import type { Session } from 'next-auth';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function founderOnly(session: Session | null): Response | null {
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
  }
  if ((session.user as { actor_role?: string }).actor_role !== 'founder') {
    return NextResponse.json(
      { ok: false, error: 'Forbidden — founder role required' },
      { status: 403 }
    );
  }
  return null;
}

/** GET — current onboarding state (founder only). */
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    return NextResponse.json({ ok: true, state: await getOnboardingState() });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

/**
 * PATCH — update onboarding state (founder only).
 * Only accepts safe scalar fields and the steps map — never trusts arbitrary keys.
 */
export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    const deny = founderOnly(session);
    if (deny) return deny;

    const body = (await req.json()) as Partial<OnboardingState>;
    const patch: Partial<OnboardingState> = {};

    // Allowlist the fields the wizard is permitted to update
    if (typeof body.completed === 'boolean') patch.completed = body.completed;
    if (typeof body.currentStep === 'number') {
      const s = Math.trunc(body.currentStep);
      if (s >= 0 && s <= 4) patch.currentStep = s;
    }
    if (typeof body.sheetsBootstrapped === 'boolean')
      patch.sheetsBootstrapped = body.sheetsBootstrapped;
    if (typeof body.seedDataLoaded === 'boolean') patch.seedDataLoaded = body.seedDataLoaded;
    if (body.completed === true) patch.completedAt = new Date().toISOString();

    // Per-step state: only accept recognised keys and boolean values
    if (body.steps && typeof body.steps === 'object') {
      const allowedSteps = ['llm', 'google', 'slack', 'roles', 'seed'] as const;
      const stepPatch: Partial<OnboardingState['steps']> = {};
      for (const key of allowedSteps) {
        const s = (body.steps as Record<string, unknown>)[key];
        if (s && typeof s === 'object') {
          const ss = s as Record<string, unknown>;
          stepPatch[key] = {
            done: typeof ss.done === 'boolean' ? ss.done : false,
            ...(typeof ss.skipped === 'boolean' ? { skipped: ss.skipped } : {}),
          };
        }
      }
      if (Object.keys(stepPatch).length) patch.steps = stepPatch as OnboardingState['steps'];
    }

    const next = await patchOnboardingState(patch);
    return NextResponse.json({ ok: true, state: next });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
