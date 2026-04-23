import {
  CONNECTOR_DEFINITIONS,
  isSecretEnvKey,
} from '@/lib/connectors-catalog';
import {
  applyStoredConnectorEnvAtStartup,
  getStoredConnectorEnv,
  keyStatus,
  patchStoredConnectorEnv,
} from '@/lib/connector-env-store';
import {
  testGoogleDriveConnect,
  testLlmConnect,
  testPostgresConnect,
  testResendConnect,
  testSlackConnect,
} from '@/lib/connector-tests';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/** Service account configured for Drive API (document uploads). */
function googleDriveReady(stored: Record<string, string>): boolean {
  const g = keyStatus('GOOGLE_SERVICE_ACCOUNT_EMAIL', stored);
  const k = keyStatus('GOOGLE_PRIVATE_KEY', stored);
  return g.effectiveSet && k.effectiveSet;
}

function postgresReady(stored: Record<string, string>): boolean {
  return keyStatus('DATABASE_URL', stored).effectiveSet;
}

function buildIntegrationPayload() {
  applyStoredConnectorEnvAtStartup();
  const stored = getStoredConnectorEnv();

  const definitions = CONNECTOR_DEFINITIONS.map((def) => {
    const fieldState = def.fields.map((f) => {
      const st = keyStatus(f.envKey, stored);
      const isSecret = isSecretEnvKey(f.envKey);
      const displayValue =
        !isSecret && st.effectiveSet
          ? (process.env[f.envKey] ?? stored[f.envKey] ?? '').trim()
          : '';
      return {
        ...f,
        envKey: f.envKey,
        status: {
          effectiveSet: st.effectiveSet,
          source: st.source,
        },
        /** Only non-secrets; empty when secret or unset */
        valueHint: displayValue,
      };
    });

    let ready = false;
    if (def.id === 'postgresql') ready = postgresReady(stored);
    else if (def.id === 'google_drive') ready = googleDriveReady(stored);
    else if (def.id === 'llm') {
      const key = keyStatus('LLM_API_KEY', stored);
      const alt = keyStatus('OPENAI_API_KEY', stored);
      ready = key.effectiveSet || alt.effectiveSet;
    } else if (def.id === 'slack')
      ready = keyStatus('SLACK_BOT_TOKEN', stored).effectiveSet;
    else if (def.id === 'email')
      ready =
        keyStatus('RESEND_API_KEY', stored).effectiveSet &&
        keyStatus('VELO_EMAIL_FROM', stored).effectiveSet;
    else if (def.id === 'cron')
      ready = keyStatus('VELO_CRON_SECRET', stored).effectiveSet;
    else if (def.id === 'auth') {
      ready =
        keyStatus('NEXTAUTH_SECRET', stored).effectiveSet &&
        keyStatus('GOOGLE_CLIENT_ID', stored).effectiveSet &&
        keyStatus('GOOGLE_CLIENT_SECRET', stored).effectiveSet;
    }

    return {
      ...def,
      ready,
      fields: fieldState,
    };
  });

  return {
    ok: true as const,
    storagePath: '.velo/connector-env.json',
    note:
      'Secrets are never returned from this API. Leave a secret field blank when saving to keep the existing value.',
    connectors: definitions,
  };
}

/** GET — connector definitions, setup steps, and per-field status (no secret values). */
export async function GET() {
  try {
    return NextResponse.json(buildIntegrationPayload());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * PUT — merge connector env vars into `.velo/connector-env.json` and apply to process.
 * Omit a key or send "" to remove it from the file (host env unchanged).
 */
export async function PUT(req: Request) {
  try {
    applyStoredConnectorEnvAtStartup();
    const body = (await req.json()) as Record<string, unknown>;
    const patch: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(body)) {
      if (v === undefined || v === null) patch[k] = '';
      else if (typeof v === 'string') patch[k] = v;
    }
    patchStoredConnectorEnv(patch);
    return NextResponse.json(buildIntegrationPayload());
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** POST { test: ConnectorId } — run a live probe (postgresql | google_drive | llm | slack | email). */
export async function POST(req: Request) {
  try {
    applyStoredConnectorEnvAtStartup();
    const body = (await req.json()) as { test?: string };
    const id = String(body.test ?? '').trim();
    let result: { ok: boolean; message: string };
    switch (id) {
      case 'postgresql':
        result = await testPostgresConnect();
        break;
      case 'google_drive':
        result = await testGoogleDriveConnect();
        break;
      case 'llm':
        result = await testLlmConnect();
        break;
      case 'slack':
        result = await testSlackConnect();
        break;
      case 'email':
        result = await testResendConnect();
        break;
      default:
        return NextResponse.json(
          { ok: false, error: 'Unknown test id' },
          { status: 400 }
        );
    }
    return NextResponse.json({
      ok: true,
      test: id,
      probe_ok: result.ok,
      message: result.message,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
