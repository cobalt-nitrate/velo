/** Live checks using current process.env (after connector file applied). */

export async function testGoogleSheetsConnect(): Promise<{
  ok: boolean;
  message: string;
}> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
  const rawKey = process.env.GOOGLE_PRIVATE_KEY?.trim();
  const key = rawKey?.replace(/\\n/g, '\n');
  const sid =
    process.env.SHEETS_CONFIG_ID?.trim() ||
    process.env.SHEETS_TRANSACTIONS_ID?.trim() ||
    process.env.SHEETS_MASTER_ID?.trim();
  if (!email || !key) {
    return {
      ok: false,
      message: 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY first.',
    };
  }
  if (!sid) {
    return {
      ok: false,
      message: 'Set at least one spreadsheet id (e.g. SHEETS_TRANSACTIONS_ID).',
    };
  }
  try {
    const { google } = await import('googleapis');
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: email,
        private_key: key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({
      version: 'v4',
      auth: authClient as Parameters<typeof google.sheets>[0]['auth'],
    });
    await sheets.spreadsheets.get({ spreadsheetId: sid, fields: 'spreadsheetId' });
    return {
      ok: true,
      message: `Connected — spreadsheet ${sid.slice(0, 8)}… is readable.`,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      message: `Sheets API error: ${msg}`,
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
