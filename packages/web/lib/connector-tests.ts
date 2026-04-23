/** Live checks using current process.env (after connector file applied). */

import { prisma } from './prisma';

export async function testPostgresConnect(): Promise<{
  ok: boolean;
  message: string;
}> {
  if (!process.env.DATABASE_URL?.trim()) {
    return { ok: false, message: 'DATABASE_URL is not set.' };
  }
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, message: 'PostgreSQL reachable.' };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: `Database error: ${msg}` };
  }
}

/** Validates Google service account + Drive folder access for document uploads. */
export async function testGoogleDriveConnect(): Promise<{
  ok: boolean;
  message: string;
}> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const key = rawKey?.replace(/\\n/g, '\n');
  if (!email || !key) {
    return {
      ok: false,
      message: 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY.',
    };
  }

  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key,
      },
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });
    const authClient = await auth.getClient();
    const authParam = authClient as Parameters<typeof google.drive>[0]['auth'];
    const drive = google.drive({ version: 'v3', auth: authParam });

    const folderId = process.env.VELO_DRIVE_FOLDER_ID?.trim();
    if (folderId) {
      const res = await drive.files.get({
        fileId: folderId,
        fields: 'id,name',
      });
      return {
        ok: true,
        message: `Drive folder OK: ${res.data.name ?? folderId.slice(0, 12)}…`,
      };
    }

    await drive.about.get({ fields: 'user' });
    return {
      ok: true,
      message:
        'Service account accepted by Drive API. Set VELO_DRIVE_FOLDER_ID to verify your output folder.',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Google Drive API error: ${msg}`,
    };
  }
}

export async function testLlmConnect(): Promise<{ ok: boolean; message: string }> {
  const apiKey =
    process.env.LLM_API_KEY?.trim() || process.env.OPENAI_API_KEY?.trim();
  const base = (
    process.env.LLM_BASE_URL?.trim() || 'https://api.openai.com/v1'
  ).replace(/\/$/, '');
  if (!apiKey) {
    return { ok: false, message: 'Set LLM_API_KEY or OPENAI_API_KEY.' };
  }
  try {
    const url = `${base}/models`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        message: `Unauthorized (${res.status}) — check API key and base URL.`,
      };
    }
    if (res.ok) {
      return {
        ok: true,
        message: 'OpenAI-compatible /models responded — credentials look valid.',
      };
    }
    if (res.status === 404) {
      return {
        ok: true,
        message: `No /models route (${res.status}); if chat calls work, you can ignore this probe.`,
      };
    }
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      message: `HTTP ${res.status}: ${body.slice(0, 200)}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function testSlackConnect(): Promise<{
  ok: boolean;
  message: string;
}> {
  const token = process.env.SLACK_BOT_TOKEN?.trim();
  if (!token) return { ok: false, message: 'Set SLACK_BOT_TOKEN.' };
  try {
    const res = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: '',
      signal: AbortSignal.timeout(12_000),
    });
    const json = (await res.json()) as {
      ok?: boolean;
      error?: string;
      team?: string;
      url?: string;
    };
    if (json.ok) {
      return {
        ok: true,
        message: `Workspace ${json.team ?? ''} — ${json.url ?? 'ok'}`,
      };
    }
    return {
      ok: false,
      message: json.error ?? 'auth.test failed',
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}

export async function testResendConnect(): Promise<{
  ok: boolean;
  message: string;
}> {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return { ok: false, message: 'Set RESEND_API_KEY.' };
  try {
    const res = await fetch('https://api.resend.com/domains', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      return { ok: true, message: 'Resend API key is valid.' };
    }
    const body = await res.text().catch(() => '');
    return {
      ok: false,
      message: `HTTP ${res.status}: ${body.slice(0, 180)}`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, message: msg };
  }
}
