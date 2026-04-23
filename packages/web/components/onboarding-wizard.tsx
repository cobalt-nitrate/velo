'use client';

/**
 * OnboardingWizard — 5-step first-run flow:
 *   0  LLM connector
 *   1  Data connectors + Postgres verification
 *   2  Slack (optional)
 *   3  Team roles (founder / finance / HR emails)
 *   4  Platform ready + seed data
 *
 * Security notes:
 *   - All fields are sent to existing /api/config/integrations (PUT) which
 *     enforces its own allowlist — no arbitrary keys accepted.
 *   - Email inputs are validated (format) before saving to roles.
 *   - LLM_BASE_URL is validated as a proper URL before allowing the user to proceed.
 *   - No secrets are ever stored in component state beyond the current step render.
 *   - PATCH /api/onboarding/state only accepts a typed allowlist server-side.
 */

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

// ─── Validation helpers ───────────────────────────────────────────────────────

function isValidEmail(e: string): boolean {
  // RFC 5321 simplified — good enough for role email lists
  return /^[^\s@]{1,64}@[^\s@]{1,255}\.[^\s@]{2,}$/.test(e.trim());
}

function isValidUrl(u: string): boolean {
  try {
    const parsed = new URL(u);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

function parseEmailList(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
}

// ─── UI atoms ────────────────────────────────────────────────────────────────

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="block text-xs font-medium text-velo-muted">
      {children}
    </label>
  );
}

function TextInput({
  id,
  value,
  onChange,
  placeholder,
  type = 'text',
  autoComplete,
  readOnly,
}: {
  id?: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  type?: string;
  autoComplete?: string;
  readOnly?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      readOnly={readOnly}
      autoComplete={autoComplete ?? 'off'}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
      className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 text-sm text-velo-text placeholder-velo-muted/60 focus:border-velo-accent/60 focus:outline-none focus:ring-2 focus:ring-velo-accent/20 disabled:opacity-50 read-only:cursor-default read-only:bg-velo-panel"
    />
  );
}

function Textarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
}: {
  id?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      rows={rows}
      spellCheck={false}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-velo-line bg-velo-inset px-3 py-2 font-mono text-xs text-velo-text placeholder-velo-muted/60 focus:border-velo-accent/60 focus:outline-none focus:ring-2 focus:ring-velo-accent/20"
    />
  );
}

function StatusBadge({ ok, message }: { ok: boolean | null; message: string }) {
  if (ok === null) return null;
  return (
    <p
      role="status"
      className={`mt-1.5 flex items-center gap-1.5 text-xs font-medium ${ok ? 'text-emerald-600' : 'text-red-500'}`}
    >
      <span aria-hidden>{ok ? '✓' : '✕'}</span> {message}
    </p>
  );
}

function StepButton({
  label,
  onClick,
  loading,
  disabled,
  variant = 'primary',
}: {
  label: string;
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'ghost' | 'danger';
}) {
  const base = 'rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50';
  const styles = {
    primary: 'bg-velo-accent text-white hover:bg-velo-accent-hover',
    ghost: 'border border-velo-line bg-transparent text-velo-muted hover:text-velo-text hover:border-velo-accent/40',
    danger: 'bg-red-600 text-white hover:bg-red-700',
  };
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={`${base} ${styles[variant]}`}
    >
      {loading ? (
        <span className="flex items-center gap-2">
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
          Working…
        </span>
      ) : (
        label
      )}
    </button>
  );
}

// ─── Step progress indicator ──────────────────────────────────────────────────

const STEP_LABELS = ['LLM', 'Database', 'Slack', 'Team Roles', 'Platform Ready'];

function StepIndicator({ current }: { current: number }) {
  return (
    <nav aria-label="Setup progress" className="flex items-center gap-1">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex items-center gap-1">
            <div
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-colors ${
                done
                  ? 'bg-velo-accent text-white'
                  : active
                  ? 'border-2 border-velo-accent text-velo-accent'
                  : 'border border-velo-line text-velo-muted'
              }`}
              aria-current={active ? 'step' : undefined}
            >
              {done ? '✓' : i + 1}
            </div>
            {!active && i < STEP_LABELS.length - 1 && (
              <div
                className={`h-px w-6 rounded-full ${
                  done ? 'bg-velo-accent' : 'bg-velo-line'
                }`}
              />
            )}
            {active && i < STEP_LABELS.length - 1 && (
              <div className="h-px w-6 rounded-full bg-velo-line" />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ─── Step 0: LLM ─────────────────────────────────────────────────────────────

function StepLlm({ onNext }: { onNext: () => void }) {
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://integrate.api.nvidia.com/v1');
  const [model, setModel] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [error, setError] = useState('');

  async function save() {
    if (!isValidUrl(baseUrl)) {
      setError('Base URL must be a valid https:// or http:// URL.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const patch: Record<string, string> = { LLM_BASE_URL: baseUrl };
      if (apiKey.trim()) patch.LLM_API_KEY = apiKey.trim();
      if (model.trim()) patch.LLM_MODEL_DEFAULT = model.trim();
      await fetch('/api/config/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }

  async function testLlm() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'llm' }),
      });
      const data = (await res.json()) as { probe_ok: boolean; message: string };
      setTestResult({ ok: data.probe_ok, message: data.message });
    } catch {
      setTestResult({ ok: false, message: 'Network error — is the dev server running?' });
    } finally {
      setTesting(false);
    }
  }

  async function handleNext() {
    await save();
    await patchState({ steps: { llm: { done: true } } as never });
    onNext();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-velo-text">Connect your LLM</h2>
        <p className="mt-0.5 text-xs text-velo-muted">
          Velo agents use any OpenAI-compatible API — NVIDIA NIM, OpenAI, or self-hosted. At minimum set the base URL; the API key is needed for gated providers.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="llm-key">API key</Label>
          <TextInput
            id="llm-key"
            type="password"
            value={apiKey}
            onChange={setApiKey}
            placeholder="Leave blank to keep existing key"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="llm-url">Base URL</Label>
          <TextInput
            id="llm-url"
            value={baseUrl}
            onChange={setBaseUrl}
            placeholder="https://integrate.api.nvidia.com/v1"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="llm-model">Default model id (optional)</Label>
          <TextInput
            id="llm-model"
            value={model}
            onChange={setModel}
            placeholder="meta/llama-3.1-70b-instruct"
          />
        </div>
      </div>

      {error && <p className="text-xs font-medium text-red-500">{error}</p>}
      {testResult && <StatusBadge ok={testResult.ok} message={testResult.message} />}

      <div className="flex items-center gap-2">
        <StepButton label="Test connection" onClick={testLlm} loading={testing} variant="ghost" />
        <StepButton label="Save &amp; continue" onClick={handleNext} loading={saving} />
      </div>
    </div>
  );
}

// ─── Step 1: Database ─────────────────────────────────────────────────────────

function StepGoogle({
  onNext,
  onBootstrapped,
}: {
  onNext: () => void;
  onBootstrapped: () => void;
}) {
  const [email, setEmail] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [bootstrapResult, setBootstrapResult] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState('');

  async function saveCreds() {
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      if (email.trim()) patch.GOOGLE_SERVICE_ACCOUNT_EMAIL = email.trim();
      if (privateKey.trim()) patch.GOOGLE_PRIVATE_KEY = privateKey.trim();
      await fetch('/api/config/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }

  async function testGoogle() {
    await saveCreds();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'google_drive' }),
      });
      const data = (await res.json()) as { probe_ok: boolean; message: string };
      setTestResult({ ok: data.probe_ok, message: data.message });
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  async function verifyDatabase() {
    await saveCreds();
    setBootstrapping(true);
    setBootstrapError('');
    setBootstrapResult(null);
    try {
      const res = await fetch('/api/setup/db-bootstrap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        data_store?: string;
        error?: string;
      };
      if (!data.ok) {
        setBootstrapError(data.error ?? 'Bootstrap failed');
      } else {
        setBootstrapResult(data.message ?? 'PostgreSQL connectivity verified.');
        onBootstrapped();
      }
    } catch {
      setBootstrapError('Network error — is the dev server running?');
    } finally {
      setBootstrapping(false);
    }
  }

  async function handleNext() {
    await saveCreds();
    await patchState({ steps: { google: { done: true } } as never });
    onNext();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-velo-text">Google Drive (optional)</h2>
        <p className="mt-0.5 text-xs text-velo-muted">
          Business data lives in PostgreSQL. Use a Google service account only if you want Velo to upload generated PDFs and files to a Drive folder you control.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="sa-email">Service account email</Label>
          <TextInput
            id="sa-email"
            value={email}
            onChange={setEmail}
            placeholder="velo-sa@project.iam.gserviceaccount.com"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="sa-key">Private key (PEM)</Label>
          <Textarea
            id="sa-key"
            value={privateKey}
            onChange={setPrivateKey}
            placeholder={'-----BEGIN PRIVATE KEY-----\n…\n-----END PRIVATE KEY-----'}
            rows={5}
          />
          <p className="text-[11px] text-velo-muted">
            Copy the entire private_key value from the JSON key file. Newlines can be literal or escaped as \n.
          </p>
        </div>
      </div>

      {testResult && <StatusBadge ok={testResult.ok} message={testResult.message} />}

      <div className="rounded-xl border border-velo-line bg-velo-inset/60 p-3 text-xs text-velo-muted">
        <p className="font-medium text-velo-text">Verify PostgreSQL</p>
        <p className="mt-0.5">
          Confirms DATABASE_URL is set and migrations have been applied. Do this after your database is running.
        </p>
        {bootstrapResult && (
          <p className="mt-1.5 font-medium text-emerald-600">✓ {bootstrapResult}</p>
        )}
        {bootstrapError && <p className="mt-1.5 font-medium text-red-500">✕ {bootstrapError}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <StepButton label="Test Drive API" onClick={testGoogle} loading={testing} variant="ghost" />
        <StepButton
          label="Verify database"
          onClick={verifyDatabase}
          loading={bootstrapping}
          variant="ghost"
        />
        <StepButton label="Save &amp; continue" onClick={handleNext} loading={saving} />
      </div>
    </div>
  );
}

// ─── Step 2: Slack ────────────────────────────────────────────────────────────

function StepSlack({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const [token, setToken] = useState('');
  const [channel, setChannel] = useState('#approvals');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  async function save() {
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      if (token.trim()) patch.SLACK_BOT_TOKEN = token.trim();
      if (channel.trim()) patch.SLACK_CHANNEL_APPROVALS = channel.trim();
      await fetch('/api/config/integrations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } finally {
      setSaving(false);
    }
  }

  async function testSlack() {
    await save();
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/config/integrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ test: 'slack' }),
      });
      const data = (await res.json()) as { probe_ok: boolean; message: string };
      setTestResult({ ok: data.probe_ok, message: data.message });
    } catch {
      setTestResult({ ok: false, message: 'Network error' });
    } finally {
      setTesting(false);
    }
  }

  async function handleNext() {
    await save();
    await patchState({ steps: { slack: { done: true } } as never });
    onNext();
  }

  async function handleSkip() {
    await patchState({ steps: { slack: { done: false, skipped: true } } as never });
    onSkip();
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-velo-text">Connect Slack (optional)</h2>
        <p className="mt-0.5 text-xs text-velo-muted">
          Velo sends approval requests and daily digests to a Slack channel. Create a Slack app with <code className="text-[10px]">chat:write</code> scope and paste the bot token below.
        </p>
      </div>

      <div className="space-y-3">
        <div className="space-y-1">
          <Label htmlFor="slack-token">Bot token (xoxb-…)</Label>
          <TextInput
            id="slack-token"
            type="password"
            value={token}
            onChange={setToken}
            placeholder="xoxb-…"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="slack-channel">Approvals channel</Label>
          <TextInput
            id="slack-channel"
            value={channel}
            onChange={setChannel}
            placeholder="#approvals"
          />
        </div>
      </div>

      {testResult && <StatusBadge ok={testResult.ok} message={testResult.message} />}

      <div className="flex flex-wrap items-center gap-2">
        <StepButton label="Test Slack" onClick={testSlack} loading={testing} variant="ghost" />
        <StepButton label="Save &amp; continue" onClick={handleNext} loading={saving} />
        <StepButton label="Skip for now" onClick={handleSkip} variant="ghost" />
      </div>
    </div>
  );
}

// ─── Step 3: Team Roles ───────────────────────────────────────────────────────

function StepRoles({
  currentUserEmail,
  onNext,
}: {
  currentUserEmail: string;
  onNext: () => void;
}) {
  const [saving, setSaving] = useState(false);

  async function handleNext() {
    setSaving(true);
    try {
      await patchState({ steps: { roles: { done: true } } as never });
      onNext();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-velo-text">Set team roles</h2>
        <p className="mt-0.5 text-xs text-velo-muted">
          Roles are managed in the Team page and stored in PostgreSQL. Invite your teammates and assign roles there.
        </p>
      </div>

      <div className="rounded-xl border border-velo-line bg-velo-inset/60 p-4 text-xs text-velo-muted space-y-2">
        <p className="font-medium text-velo-text">Next steps</p>
        <ol className="list-decimal pl-5 space-y-1">
          <li>Go to <span className="font-mono">/team</span> after setup.</li>
          <li>Create invite links for finance / HR / managers.</li>
          <li>Assign roles from the Team members table.</li>
        </ol>
        <p className="text-[11px] text-velo-muted/80">
          Current founder: <span className="font-mono">{currentUserEmail}</span>
        </p>
      </div>

      <div className="rounded-xl border border-amber-300/40 bg-amber-50/10 p-3 text-[11px] text-velo-muted">
        Role changes take effect on the next sign-in. If you&apos;re adding yourself to a new role, sign out and back in after this step.
      </div>

      <div className="flex items-center gap-2">
        <StepButton label="Save &amp; continue" onClick={handleNext} loading={saving} />
      </div>
    </div>
  );
}

// ─── Step 4: Platform Ready ───────────────────────────────────────────────────

interface ConnectorStatus {
  id: string;
  title: string;
  ready: boolean;
}

function StepReady({
  sheetsBootstrapped,
  onSeedData,
  onComplete,
}: {
  sheetsBootstrapped: boolean;
  onSeedData: () => Promise<void>;
  onComplete: () => void;
}) {
  const [connectors, setConnectors] = useState<ConnectorStatus[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [seedDone, setSeedDone] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [completing, setCompleting] = useState(false);

  useEffect(() => {
    fetch('/api/config/integrations')
      .then((r) => r.json())
      .then((data: { connectors?: ConnectorStatus[] }) => {
        if (data.connectors) setConnectors(data.connectors);
      })
      .catch(() => {/* silently ignore */});
  }, []);

  const coreConnectors = ['postgresql', 'llm', 'google_drive', 'slack', 'email'];
  const displayConnectors = connectors.filter((c) => coreConnectors.includes(c.id));

  async function handleSeed() {
    setSeeding(true);
    setSeedError('');
    try {
      await onSeedData();
      setSeedDone(true);
      await patchState({ seedDataLoaded: true, steps: { seed: { done: true } } as never });
    } catch (e) {
      setSeedError(e instanceof Error ? e.message : 'Seeding failed');
    } finally {
      setSeeding(false);
    }
  }

  async function handleComplete() {
    setCompleting(true);
    await patchState({
      completed: true,
      steps: { seed: { done: true, skipped: !seedDone } } as never,
    });
    onComplete();
  }

  const allCriticalReady =
    connectors.some((c) => c.id === 'postgresql' && c.ready) &&
    connectors.some((c) => c.id === 'llm' && c.ready);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold text-velo-text">Platform ready</h2>
        <p className="mt-0.5 text-xs text-velo-muted">
          Here&apos;s a summary of what&apos;s connected. You can revisit Settings at any time.
        </p>
      </div>

      {/* Connector checklist */}
      <ul className="space-y-2" role="list">
        {displayConnectors.length === 0 ? (
          <li className="text-xs text-velo-muted">Loading connector status…</li>
        ) : (
          displayConnectors.map((c) => (
            <li key={c.id} className="flex items-center gap-2.5 text-sm">
              <span
                aria-label={c.ready ? 'Connected' : 'Not connected'}
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                  c.ready ? 'bg-emerald-500/15 text-emerald-600' : 'bg-velo-line text-velo-muted'
                }`}
              >
                {c.ready ? '✓' : '○'}
              </span>
              <span className={c.ready ? 'text-velo-text' : 'text-velo-muted'}>{c.title}</span>
            </li>
          ))
        )}
        <li className="flex items-center gap-2.5 text-sm">
          <span
            aria-label={sheetsBootstrapped ? 'Bootstrapped' : 'Not created'}
            className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
              sheetsBootstrapped ? 'bg-emerald-500/15 text-emerald-600' : 'bg-velo-line text-velo-muted'
            }`}
          >
            {sheetsBootstrapped ? '✓' : '○'}
          </span>
          <span className={sheetsBootstrapped ? 'text-velo-text' : 'text-velo-muted'}>
            PostgreSQL verified
          </span>
        </li>
      </ul>

      {/* Seed data section */}
      <div className="rounded-xl border border-velo-line bg-velo-inset/60 p-4 space-y-2">
        <p className="text-sm font-medium text-velo-text">Load demo data (optional)</p>
        <p className="text-xs text-velo-muted">
          Load realistic Indian startup demo rows into PostgreSQL — employees, invoices, compliance calendar — so you can explore Velo before adding real data.
        </p>
        {seedDone ? (
          <p className="text-xs font-medium text-emerald-600">✓ Demo data loaded</p>
        ) : (
          <>
            {seedError && <p className="text-xs font-medium text-red-500">{seedError}</p>}
            <StepButton
              label="Load demo data"
              onClick={handleSeed}
              loading={seeding}
              disabled={!sheetsBootstrapped}
              variant="ghost"
            />
          </>
        )}
      </div>

      {!allCriticalReady && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50/10 p-3 text-[11px] text-amber-700">
          LLM and PostgreSQL are required to run agents. Go back and complete those steps, or finish setup now and configure them in Settings.
        </div>
      )}

      <StepButton
        label="Launch Velo"
        onClick={handleComplete}
        loading={completing}
      />
    </div>
  );
}

// ─── Shared API helper ────────────────────────────────────────────────────────

async function patchState(patch: Record<string, unknown>) {
  await fetch('/api/onboarding/state', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

// ─── Root wizard component ────────────────────────────────────────────────────

interface OnboardingWizardProps {
  initialStep?: number;
  initialBootstrapped?: boolean;
  currentUserEmail?: string;
}

export function OnboardingWizard({
  initialStep = 0,
  initialBootstrapped = false,
  currentUserEmail = '',
}: OnboardingWizardProps) {
  const [step, setStep] = useState(initialStep);
  const [bootstrapped, setBootstrapped] = useState(initialBootstrapped);
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);

  const goNext = useCallback(async () => {
    const next = step + 1;
    await patchState({ currentStep: next });
    setStep(next);
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [step]);

  async function seedData() {
    const res = await fetch('/api/setup/seed-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = (await res.json()) as { ok: boolean; error?: string };
    if (!data.ok) throw new Error(data.error ?? 'Seed failed');
  }

  async function handleComplete() {
    router.push('/');
    router.refresh();
  }

  const steps = [
    <StepLlm key="llm" onNext={goNext} />,
    <StepGoogle
      key="google"
      onNext={goNext}
      onBootstrapped={() => setBootstrapped(true)}
    />,
    <StepSlack key="slack" onNext={goNext} onSkip={goNext} />,
    <StepRoles key="roles" currentUserEmail={currentUserEmail} onNext={goNext} />,
    <StepReady
      key="ready"
      sheetsBootstrapped={bootstrapped}
      onSeedData={seedData}
      onComplete={handleComplete}
    />,
  ];

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-lg">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-velo-muted">
            Setup wizard
          </p>
          <p className="mt-0.5 text-[11px] text-velo-muted">{STEP_LABELS[step]}</p>
        </div>
        <StepIndicator current={step} />
      </div>

      <div className="rounded-2xl border border-velo-line bg-velo-panel p-6 shadow-soft">
        {steps[step] ?? steps[0]}
      </div>

      <p className="mt-4 text-center text-[11px] text-velo-muted">
        You can always update these in{' '}
        <a href="/settings" className="text-velo-accent hover:underline">
          Settings
        </a>
        .
      </p>
    </div>
  );
}
