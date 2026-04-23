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
    'DATABASE_URL',
    'GOOGLE_PRIVATE_KEY',
    'LLM_API_KEY',
    'OPENAI_API_KEY',
    'SLACK_BOT_TOKEN',
    'SLACK_SIGNING_SECRET',
    'RESEND_API_KEY',
    'NEXTAUTH_SECRET',
    'VELO_CRON_SECRET',
  ].map((k) => k.toUpperCase())
);

export function isSecretEnvKey(key: string): boolean {
  return CONNECTOR_SECRET_KEYS.has(key.toUpperCase());
}

export const CONNECTOR_DEFINITIONS: ConnectorDefinition[] = [
  {
    id: 'postgresql',
    title: 'PostgreSQL',
    summary:
      'Velo stores invoices, payroll, approvals, and other business data in PostgreSQL (via Prisma).',
    steps: [
      'Provision a Postgres instance (local Docker, RDS, Neon, etc.) and run migrations: `npx prisma migrate deploy` from packages/web.',
      'Set DATABASE_URL to the connection string (often in `.env.local` or below). The app will not persist agent/tool writes without it.',
    ],
    fields: [
      {
        envKey: 'DATABASE_URL',
        label: 'Connection string',
        sensitive: true,
        multiline: true,
        placeholder: 'postgresql://user:pass@host:5432/dbname',
      },
    ],
  },
  {
    id: 'google_drive',
    title: 'Google Drive',
    summary:
      'Service account access for uploading generated PDFs and storing file links. Business data is never stored in Google Sheets.',
    docsUrl: 'https://cloud.google.com/iam/docs/service-accounts',
    steps: [
      'In Google Cloud Console, enable the Google Drive API for your project.',
      'IAM → Service Accounts → Create a JSON key. Copy `client_email` and `private_key` into the fields below.',
      'Create a Drive folder for Velo outputs, share it with the service account (Editor), and set VELO_DRIVE_FOLDER_ID to the folder id from the URL.',
      'Values merge from `.velo/connector-env.json` on server start where host env is empty. Saving in this UI updates that file.',
    ],
    fields: [
      {
        envKey: 'GOOGLE_SERVICE_ACCOUNT_EMAIL',
        label: 'Service account email',
        placeholder: 'velo-sa@project.iam.gserviceaccount.com',
        optional: true,
      },
      {
        envKey: 'GOOGLE_PRIVATE_KEY',
        label: 'Private key (PEM)',
        sensitive: true,
        multiline: true,
        optional: true,
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
    id: 'auth',
    title: 'Sign-in (NextAuth)',
    summary: 'Credentials-based login for the Command Center.',
    steps: [
      'Set NEXTAUTH_URL for the public app URL (e.g. http://localhost:3000).',
      'Set NEXTAUTH_SECRET to a long random string.',
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
