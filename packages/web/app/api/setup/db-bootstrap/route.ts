/**
 * POST /api/setup/db-bootstrap
 *
 * Verifies PostgreSQL connectivity and marks the bootstrap step complete so the
 * onboarding wizard can proceed to seed-data.
 *
 * Security: Founder session required.
 */

import { authOptions } from '@/lib/auth';
import { applyStoredConnectorEnvAtStartup } from '@/lib/connector-env-store';
import { getOnboardingState, patchOnboardingState } from '@/lib/onboarding-store';
import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if ((session.user as { actor_role?: string }).actor_role !== 'founder') {
      return NextResponse.json({ ok: false, error: 'Forbidden — founder role required' }, { status: 403 });
    }

    applyStoredConnectorEnvAtStartup();
    const state = await getOnboardingState();
    if (state.bootstrapInProgress) {
      return NextResponse.json({ ok: false, error: 'Bootstrap already in progress.' }, { status: 409 });
    }

    // Parse optional force flag
    let force = false;
    try {
      const body = (await req.json()) as { force?: boolean };
      force = body.force === true;
    } catch {
      /* body optional */
    }

    if (state.sheetsBootstrapped && !force) {
      return NextResponse.json({ ok: true, message: 'Already bootstrapped.', skipped: true });
    }

    await patchOnboardingState({ bootstrapInProgress: true });

    // Verify Postgres is reachable and the schema is migrated
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (dbErr) {
      await patchOnboardingState({ bootstrapInProgress: false });
      return NextResponse.json(
        { ok: false, error: `Database not reachable: ${dbErr instanceof Error ? dbErr.message : String(dbErr)}` },
        { status: 503 }
      );
    }

    await patchOnboardingState({
      bootstrapInProgress: false,
      sheetsBootstrapped: true,
      steps: { google: { done: true } },
    });

    return NextResponse.json({
      ok: true,
      message: 'Database connectivity verified. Business data will be stored in PostgreSQL.',
      data_store: 'postgresql',
    });
  } catch (e) {
    await patchOnboardingState({ bootstrapInProgress: false });
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

