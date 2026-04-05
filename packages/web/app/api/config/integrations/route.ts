import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

function set(id: string): boolean {
  return Boolean(process.env[id]?.trim());
}

/**
 * GET — which connector env vars are present (names only; never echo secrets).
 * Wire your real keys in .env.local / deployment secrets.
 */
export async function GET() {
  const sheetsConfigured =
    set('GOOGLE_SERVICE_ACCOUNT_EMAIL') &&
    set('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

  const sheetIds = [
    'SHEETS_CONFIG_ID',
    'SHEETS_TRANSACTIONS_ID',
    'SHEETS_AP_ID',
    'SHEETS_AR_ID',
    'SHEETS_PAYROLL_ID',
    'SHEETS_HR_ID',
    'SHEETS_BANK_ID',
    'VELO_LOGS_SPREADSHEET_ID',
  ];

  return NextResponse.json({
    ok: true,
    connectors: {
      google_sheets: {
        configured: sheetsConfigured,
        spreadsheet_ids_present: Object.fromEntries(
          sheetIds.map((k) => [k, set(k)])
        ),
      },
      llm_openai_compatible: {
        configured: set('LLM_API_KEY') || set('OPENAI_API_KEY'),
        env_hint: 'LLM_API_KEY, LLM_BASE_URL (OpenAI-compatible, e.g. NVIDIA NIM)',
      },
      slack: {
        configured: set('SLACK_BOT_TOKEN'),
        env_hint: 'SLACK_BOT_TOKEN, SLACK_CHANNEL_APPROVALS, …',
      },
      resend_email: {
        configured: set('RESEND_API_KEY'),
        env_hint: 'RESEND_API_KEY — used by packages/tools/src/email',
      },
      workflow_state: {
        configured: true,
        env_hint:
          'VELO_STATE_DIR optional — defaults to <repo>/.velo/workflow-runs.json (via getRepoRoot)',
      },
      cron_and_digest: {
        configured: set('VELO_CRON_SECRET'),
        env_hint:
          'VELO_CRON_SECRET — POST /api/cron/digest, /api/cron/escalate-approvals (x-velo-cron-secret header). VELO_DIGEST_EMAIL_TO, VELO_APPROVAL_EMAIL_TO optional.',
      },
    },
  });
}
