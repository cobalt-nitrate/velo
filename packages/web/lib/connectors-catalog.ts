/** User-facing connector definitions for Settings → Connectors (no secrets). */

export type ConnectorField = {
  envKey: string;
  label: string;
  /** password = never echo from API; user leaves blank to keep existing */
  sensitive?: boolean;
  multiline?: boolean;
  placeholder?: string;
  optional?: boolean;
};

export type ConnectorDefinition = {
  id: string;
  title: string;
  summary: string;
  docsUrl?: string;
  steps: string[];
  fields: ConnectorField[];
};

export const CONNECTOR_SECRET_KEYS = new Set(
  [
    'GOOGLE_PRIVATE_KEY',
    'LLM_API_KEY',
    'OPENAI_API_KEY',
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'RESEND_API_KEY',
    'NEXTAUTH_SECRET',
    'GOOGLE_CLIENT_SECRET',
    'VELO_CRON_SECRET',
  ].map((k) => k.toUpperCase())
);

export function isSecretEnvKey(key: string): boolean {
  return CONNECTOR_SECRET_KEYS.has(key.toUpperCase());
}

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    id: 'google_workspace',
    title: 'Google Sheets & Drive',
    summary:
      'Service account access to your Velo spreadsheets and optional Drive uploads for generated documents.',
    docsUrl: 'https://cloud.google.com/iam/docs/service-accounts',
    steps: [
      'In Google Cloud Console, create or pick a project, then APIs & Services → Enable Google Sheets API and Google Drive API.',
      'IAM → Service Accounts → Create key (JSON). Copy the client_email and private_key into the fields below.',
      'Share each target spreadsheet with the service account email as Editor (use the spreadsheet’s Share dialog).',
      'Paste the spreadsheet IDs from the URL (the long id between /d/ and /edit) into the SHEETS_* fields.',
      'For PDF/Drive uploads, create a Drive folder, share it with the service account, and set VELO_DRIVE_FOLDER_ID to the folder id from the URL.',
      'Alternatively, copy variables into `.env.local` in the repo root — values here are merged from `.velo/connector-env.json` on server start (empty env slots only). Saving in this UI updates the file and applies to the running server immediately.',
    ],
    fields: [
      {
        envKey: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        label: 'Service account email',
        placeholder: 'velo-sa@project.iam.gserviceaccount.com',
      },
      {
        envKey: 'GOOGLE_PRIVATE_KEY',
        label: 'Private key (PEM)',
        sensitive: true,
        multiline: true,
        placeholder: '-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----',
      },
      {
        envKey: 'GOOGLE_PROJECT_ID',
        label: 'GCP project id',
        optional: true,
        placeholder: 'my-project-123',
      },
      {
        envKey: 'VELO_DRIVE_FOLDER_ID',
        label: 'Drive folder id (generated docs)',
        optional: true,
        placeholder: '1AbC… folder id from drive.google.com',
      },
      {
        envKey: 'SHEETS_CONFIG_ID',
        label: 'CONFIG spreadsheet id',
        placeholder: 'company_settings, tax_rates, …',
      },
      {
        envKey: 'SHEETS_MASTER_ID',
        label: 'MASTER spreadsheet id',
        placeholder: 'employees, vendors, clients, …',
      },
      {
        envKey: 'SHEETS_TRANSACTIONS_ID',
        label: 'TRANSACTIONS spreadsheet id',
        placeholder: 'ap_invoices, ar_invoices, approvals, payroll, bank, …',
      },
      {
        envKey: 'SHEETS_COMPLIANCE_ID',
        label: 'COMPLIANCE spreadsheet id',
        optional: true,
      },
      {
        envKey: 'SHEETS_LOGS_ID',
        label: 'LOGS spreadsheet id',
        optional: true,
        placeholder: 'audit_trail, file_links, …',
      },
    ],
  },
  {
    id: 'llm',
    title: 'LLM (OpenAI-compatible)',
    summary: 'NVIDIA NIM, OpenAI, or any OpenAI-compatible HTTP API for agents.',
    docsUrl: 'https://platform.openai.com/docs/api-reference',
    steps: [
      'Obtain an API key from your provider (e.g. NVIDIA API catalog or OpenAI).',
      'Set LLM_BASE_URL to the chat completions base (e.g. https://integrate.api.nvidia.com/v1).',
      'Optionally set LLM_MODEL_DEFAULT for agents that reference unset per-model env vars.',
      'You may set LLM_API_KEY or OPENAI_API_KEY — both are accepted by the runtime.',
    ],
    fields: [
      {
        envKey: 'LLM_API_KEY',
        label: 'API key (LLM_API_KEY)',
        sensitive: true,
        optional: true,
        placeholder: 'Primary key for agents package',
      },
      {
        envKey: 'OPENAI_API_KEY',
        label: 'API key (OPENAI_API_KEY)',
        sensitive: true,
        optional: true,
        placeholder: 'Fallback if LLM_API_KEY is empty',
      },
      {
        envKey: 'LLM_BASE_URL',
        label: 'Base URL',
        placeholder: 'https://integrate.api.nvidia.com/v1',
      },
      {
        envKey: 'LLM_MODEL_DEFAULT',
        label: 'Default model id',
        optional: true,
        placeholder: 'e.g. meta/llama-3.1-70b-instruct',
      },
    ],
  },
  {
    id: 'slack',
    title: 'Slack',
    summary: 'Bot token for approval notifications and digests to a channel.',
    docsUrl: 'https://api.slack.com/authentication/token-types#bot',
    steps: [
      'Create a Slack app at api.slack.com → OAuth & Permissions → Bot Token Scopes: chat:write, channels:read (and files if needed).',
      'Install to workspace and copy the Bot User OAuth Token (starts with xoxb-).',
      'Optional: set SLACK_CHANNEL_APPROVALS to a channel name like #approvals (defaults apply in tools).',
      'Signing secret is used if you add Slack HTTP endpoints later.',
    ],
    fields: [
      {
        envKey: 'SLACK_BOT_TOKEN',
        label: 'Bot token (xoxb-…)',
        sensitive: true,
      },
      {
        envKey: 'SLACK_SIGNING_SECRET',
        label: 'Signing secret',
        sensitive: true,
        optional: true,
      },
      {
        envKey: 'SLACK_CHANNEL_APPROVALS',
        label: 'Approvals channel',
        optional: true,
        placeholder: '#approvals',
      },
    ],
  },
  {
    id: 'email',
    title: 'Email (Resend)',
    summary: 'Transactional email for invoices, approvals, and cron digests.',
    docsUrl: 'https://resend.com/docs',
    steps: [
      'Sign up at resend.com, create an API key, and verify your sending domain.',
      'Set RESEND_API_KEY and VELO_EMAIL_FROM (must be a verified domain).',
      'Optional: VELO_DIGEST_EMAIL_TO and VELO_APPROVAL_EMAIL_TO for operator inboxes.',
    ],
    fields: [
      {
        envKey: 'RESEND_API_KEY',
        label: 'Resend API key',
        sensitive: true,
      },
      {
        envKey: 'VELO_EMAIL_FROM',
        label: 'From address',
        placeholder: 'Velo <noreply@yourdomain.com>',
      },
      {
        envKey: 'VELO_DIGEST_EMAIL_TO',
        label: 'Digest recipient (cron)',
        optional: true,
        placeholder: 'founder@company.com',
      },
      {
        envKey: 'VELO_APPROVAL_EMAIL_TO',
        label: 'Approval notifications recipient',
        optional: true,
      },
    ],
  },
  {
    id: 'cron',
    title: 'Cron & webhooks',
    summary: 'Protect scheduled routes that send digests or escalate approvals.',
    steps: [
      'Generate a long random string for VELO_CRON_SECRET.',
      'Call POST /api/cron/digest and /api/cron/escalate-approvals with header x-velo-cron-secret.',
      'In production, use your host’s cron jobs or a scheduler pointing at these URLs.',
    ],
    fields: [
      {
        envKey: 'VELO_CRON_SECRET',
        label: 'Shared cron secret',
        sensitive: true,
        placeholder: 'long random string',
      },
    ],
  },
  {
    id: 'access_control',
    title: 'Team Access & Roles',
    summary: 'Which Google accounts can sign in, and who gets founder / finance / HR roles.',
    steps: [
      'Set VELO_ALLOWED_DOMAIN to restrict sign-in to one domain (e.g. acme.com). Leave blank to allow any Google account.',
      'List founder emails in VELO_FOUNDER_EMAILS (comma-separated). These users can approve actions and configure Velo.',
      'List finance team emails in VELO_FINANCE_EMAILS and HR team emails in VELO_HR_EMAILS.',
      'All other authenticated users default to the employee role.',
    ],
    fields: [
      {
        envKey: 'VELO_ALLOWED_DOMAIN',
        label: 'Allowed sign-in domain',
        optional: true,
        placeholder: 'acme.com — leave blank for any Google account',
      },
      {
        envKey: 'VELO_FOUNDER_EMAILS',
        label: 'Founder emails (comma-separated)',
        placeholder: 'alice@acme.com, bob@acme.com',
      },
      {
        envKey: 'VELO_FINANCE_EMAILS',
        label: 'Finance lead emails (comma-separated)',
        optional: true,
        placeholder: 'cfo@acme.com',
      },
      {
        envKey: 'VELO_HR_EMAILS',
        label: 'HR lead emails (comma-separated)',
        optional: true,
        placeholder: 'hr@acme.com',
      },
    ],
  },
  {
    id: 'auth',
    title: 'Sign-in (NextAuth + Google)',
    summary: 'Optional: Google OAuth for the Command Center login page.',
    docsUrl: 'https://console.cloud.google.com/apis/credentials',
    steps: [
      'In Google Cloud Console → Credentials → OAuth 2.0 Client ID (Web).',
      'Authorized redirect URI: https://your-host/api/auth/callback/google (and http://localhost:3000/api/auth/callback/google for dev).',
      'Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, NEXTAUTH_SECRET, and NEXTAUTH_URL in env or below.',
    ],
    fields: [
      {
        envKey: 'NEXTAUTH_URL',
        label: 'Public app URL',
        placeholder: 'http://localhost:3000',
      },
      {
        envKey: 'NEXTAUTH_SECRET',
        label: 'NextAuth secret',
        sensitive: true,
      },
      {
        envKey: 'GOOGLE_CLIENT_ID',
        label: 'Google OAuth client id',
      },
      {
        envKey: 'GOOGLE_CLIENT_SECRET',
        label: 'Google OAuth client secret',
        sensitive: true,
      },
    ],
  },
];

export function allAllowedConnectorKeys(): string[] {
  const keys = new Set<string>();
  for (const c of CONNECTOR_DEFINITIONS) {
    for (const f of c.fields) keys.add(f.envKey);
  }
  return [...keys];
}
