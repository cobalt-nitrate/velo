/**
 * POST /api/setup/seed-data
 *
 * Appends demo rows from data/mock/velo-demo-seed.json into the bootstrapped sheets.
 * Idempotent by default — returns 409 if already seeded unless { force: true }.
 *
 * Security:
 *  - Founder session required.
 *  - Sheets must already be bootstrapped (sheetsBootstrapped === true).
 *  - Rate-limited writes (400 ms between each table append) — mirrors the CLI script.
 *  - Quota-aware retry for 429 / RESOURCE_EXHAUSTED responses.
 *  - Seed file is loaded from a fixed server-side path; no user-supplied path accepted.
 */

import { authOptions } from '@/lib/auth';
import { applyStoredConnectorEnvAtStartup } from '@/lib/connector-env-store';
import {
  getOnboardingState,
  patchOnboardingState,
} from '@/lib/onboarding-store';
import { google } from 'googleapis';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 120;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

function columnLetter(n: number): string {
  let result = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    result = String.fromCharCode(65 + rem) + result;
    n = Math.floor((n - 1) / 26);
  }
  return result;
}

async function withQuotaRetry<T>(fn: () => Promise<T>, maxAttempts = 5): Promise<T> {
  let delay = 2500;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retry = /quota|429|503|RESOURCE_EXHAUSTED|ECONNRESET/i.test(msg);
      if (!retry || attempt === maxAttempts) throw e;
      await sleep(delay);
      delay = Math.min(delay * 2, 30_000);
    }
  }
  throw new Error('unreachable');
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface SeedTable {
  envKey: string;
  sheet: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    // 1. Auth — founder only
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ ok: false, error: 'Unauthenticated' }, { status: 401 });
    }
    if ((session.user as { actor_role?: string }).actor_role !== 'founder') {
      return NextResponse.json({ ok: false, error: 'Forbidden — founder role required' }, { status: 403 });
    }

    applyStoredConnectorEnvAtStartup();
    const state = getOnboardingState();

    // 2. Must have bootstrapped sheets first
    if (!state.sheetsBootstrapped) {
      return NextResponse.json(
        { ok: false, error: 'Create the Google Sheets workbooks first (sheets-bootstrap).' },
        { status: 422 }
      );
    }

    // 3. Parse optional force flag
    let force = false;
    try {
      const body = (await req.json()) as { force?: boolean };
      force = body.force === true;
    } catch {
      /* body optional */
    }

    if (state.seedDataLoaded && !force) {
      return NextResponse.json(
        { ok: false, error: 'Demo data already loaded. Pass { force: true } to re-seed.' },
        { status: 409 }
      );
    }

    // 4. Load seed file from fixed server-side path (no user input involved)
    const seedPath = join(process.cwd(), '..', '..', 'data', 'mock', 'velo-demo-seed.json');
    if (!existsSync(seedPath)) {
      return NextResponse.json(
        { ok: false, error: 'Demo seed file not found. Run `pnpm run seed-mock:generate` first.' },
        { status: 422 }
      );
    }

    const raw = JSON.parse(readFileSync(seedPath, 'utf-8')) as { tables?: SeedTable[] };
    const tables = raw.tables;
    if (!Array.isArray(tables)) {
      return NextResponse.json(
        { ok: false, error: 'Invalid seed file format.' },
        { status: 422 }
      );
    }

    // 5. Google auth
    const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim();
    const privateKeyRaw = process.env.GOOGLE_PRIVATE_KEY?.trim();
    if (!saEmail || !privateKeyRaw) {
      return NextResponse.json(
        { ok: false, error: 'Google credentials not configured.' },
        { status: 422 }
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: saEmail, private_key: privateKeyRaw.replace(/\\n/g, '\n') },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const sheetsClient = google.sheets({ version: 'v4', auth });

    // Tab existence cache per spreadsheet (one meta call per workbook, not per tab)
    const tabCache = new Map<string, Set<string>>();
    async function getTabSet(spreadsheetId: string): Promise<Set<string>> {
      if (tabCache.has(spreadsheetId)) return tabCache.get(spreadsheetId)!;
      const meta = await withQuotaRetry(() =>
        sheetsClient.spreadsheets.get({
          spreadsheetId,
          fields: 'sheets.properties.title',
        })
      );
      const s = new Set((meta.data.sheets ?? []).map((sh) => sh.properties?.title ?? '').filter(Boolean));
      tabCache.set(spreadsheetId, s);
      return s;
    }

    const results: { sheet: string; rows: number }[] = [];
    const warnings: string[] = [];

    for (const t of tables) {
      const { envKey, sheet, headers, rows } = t;
      if (!envKey || !sheet || !Array.isArray(headers) || !Array.isArray(rows) || rows.length === 0) continue;

      const spreadsheetId = process.env[envKey]?.trim();
      if (!spreadsheetId) {
        warnings.push(`Skip ${sheet}: ${envKey} not set`);
        continue;
      }

      const tabs = await getTabSet(spreadsheetId);
      if (!tabs.has(sheet)) {
        warnings.push(`Skip ${sheet}: tab not found in workbook`);
        continue;
      }

      const values = rows.map((obj) =>
        headers.map((h) => {
          const v = (obj as Record<string, unknown>)[h];
          return v === null || v === undefined ? '' : String(v);
        })
      );
      const endCol = columnLetter(headers.length);

      await withQuotaRetry(() =>
        sheetsClient.spreadsheets.values.append({
          spreadsheetId,
          range: `${sheet}!A:${endCol}`,
          valueInputOption: 'RAW',
          insertDataOption: 'INSERT_ROWS',
          requestBody: { values },
        })
      );

      results.push({ sheet, rows: rows.length });
      await sleep(400);
    }

    patchOnboardingState({ seedDataLoaded: true });

    return NextResponse.json({
      ok: true,
      seeded: results,
      warnings,
      totalRows: results.reduce((s, r) => s + r.rows, 0),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const isQuota = /quota|429|RESOURCE_EXHAUSTED/i.test(message);
    return NextResponse.json(
      { ok: false, error: isQuota ? 'Google Sheets quota exceeded. Wait 60 seconds.' : message },
      { status: isQuota ? 429 : 500 }
    );
  }
}
