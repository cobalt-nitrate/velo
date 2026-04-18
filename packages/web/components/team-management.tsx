'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Role = 'founder' | 'finance_lead' | 'hr_lead' | 'manager' | 'employee';
type InviteRole = 'finance_lead' | 'hr_lead' | 'manager' | 'employee';

interface Member {
  email: string;
  name: string | null;
  image: string | null;
  role: Role;
  firstSignIn: string;
  lastSignIn: string;
  revokedAt: string | null;
}

interface InviteRecord {
  token: string;
  role: InviteRole;
  email: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  consumedAt: string | null;
  consumedBy: string | null;
}

const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  finance_lead: 'Finance Lead',
  hr_lead: 'HR Lead',
  manager: 'Manager',
  employee: 'Employee',
};

const ASSIGNABLE_ROLES: InviteRole[] = ['finance_lead', 'hr_lead', 'manager', 'employee'];

function Badge({ role, revoked }: { role: string; revoked?: boolean }) {
  if (revoked) {
    return (
      <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-red-500/15 text-red-600">
        Revoked
      </span>
    );
  }
  const colours: Record<string, string> = {
    founder: 'bg-velo-accent/15 text-velo-accent',
    finance_lead: 'bg-blue-500/15 text-blue-600',
    hr_lead: 'bg-purple-500/15 text-purple-600',
    manager: 'bg-amber-500/15 text-amber-700',
    employee: 'bg-velo-inset text-velo-muted',
  };
  return (
    <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${colours[role] ?? colours.employee}`}>
      {ROLE_LABELS[role] ?? role}
    </span>
  );
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function Avatar({ name, image }: { name: string | null; image: string | null }) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name ?? 'User'} className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />;
  }
  const initials = (name ?? '?').split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase();
  return (
    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-velo-accent/15 text-xs font-semibold text-velo-accent">
      {initials}
    </div>
  );
}

export function TeamManagement({ currentUserEmail }: { currentUserEmail: string }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<InviteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Invite form state
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteRole, setInviteRole] = useState<InviteRole>('employee');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteNote, setInviteNote] = useState('');
  const [creatingInvite, setCreatingInvite] = useState(false);
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null);
  const copyRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [membersRes, invitesRes] = await Promise.all([
        fetch('/api/team/members'),
        fetch('/api/team/invites'),
      ]);
      const membersData = await membersRes.json() as { ok: boolean; users?: Member[]; error?: string };
      const invitesData = await invitesRes.json() as { ok: boolean; invites?: InviteRecord[]; error?: string };
      if (!membersData.ok) throw new Error(membersData.error ?? 'Failed to load members');
      if (!invitesData.ok) throw new Error(invitesData.error ?? 'Failed to load invites');
      setMembers(membersData.users ?? []);
      setInvites(invitesData.invites ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function changeRole(email: string, role: InviteRole) {
    try {
      const res = await fetch('/api/team/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Failed to change role');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function toggleRevoke(member: Member) {
    const action = member.revokedAt ? 'restore' : 'revoke';
    const confirmMsg = action === 'revoke'
      ? `Revoke access for ${member.email}? They will be blocked from signing in immediately.`
      : `Restore access for ${member.email}?`;
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/team/members', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: member.email, action }),
      });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Failed');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function cancelInvite(token: string) {
    if (!confirm('Cancel this invite link? The URL will stop working immediately.')) return;
    try {
      const res = await fetch(`/api/team/invites/${token}`, { method: 'DELETE' });
      const data = await res.json() as { ok: boolean; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Failed to cancel invite');
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    }
  }

  async function createInvite() {
    if (!inviteRole) return;
    setCreatingInvite(true);
    try {
      const body: Record<string, string> = { role: inviteRole };
      const trimmedEmail = inviteEmail.trim();
      if (trimmedEmail) body.email = trimmedEmail;
      if (inviteNote.trim()) body.note = inviteNote.trim();

      const res = await fetch('/api/team/invites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { ok: boolean; inviteUrl?: string; error?: string };
      if (!data.ok) throw new Error(data.error ?? 'Failed to create invite');

      setNewInviteUrl(data.inviteUrl ?? null);
      setInviteEmail('');
      setInviteNote('');
      setShowInviteForm(false);
      await load();
    } catch (e) {
      alert(e instanceof Error ? e.message : String(e));
    } finally {
      setCreatingInvite(false);
    }
  }

  function copyInviteUrl() {
    if (!newInviteUrl) return;
    copyRef.current?.select();
    navigator.clipboard.writeText(newInviteUrl).catch(() => {
      copyRef.current?.select();
      document.execCommand('copy');
    });
  }

  const pendingInvites = invites.filter((i) => !i.consumedAt);
  const consumedInvites = invites.filter((i) => i.consumedAt);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-velo-accent border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-300/40 bg-red-50/20 p-4 text-sm text-red-600">
        {error}
        <button onClick={() => void load()} className="ml-2 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* New invite URL banner */}
      {newInviteUrl && (
        <div className="rounded-lg border border-velo-accent/30 bg-velo-accent/5 p-4 space-y-2">
          <p className="text-sm font-medium text-velo-text">Invite link created — share it with your team member:</p>
          <div className="flex items-center gap-2">
            <input
              ref={copyRef}
              readOnly
              value={newInviteUrl}
              className="flex-1 rounded border border-velo-line bg-velo-inset px-2 py-1.5 text-xs font-mono text-velo-text focus:outline-none"
              onFocus={(e) => e.target.select()}
            />
            <button
              type="button"
              onClick={copyInviteUrl}
              className="shrink-0 rounded bg-velo-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-velo-accent/90"
            >
              Copy
            </button>
          </div>
          <p className="text-[11px] text-velo-muted">This link expires in 48 hours and can only be used once.</p>
          <button
            type="button"
            onClick={() => setNewInviteUrl(null)}
            className="text-[11px] text-velo-muted underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Members table */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-velo-text">Team members ({members.length})</h2>
          <button
            type="button"
            onClick={() => setShowInviteForm((v) => !v)}
            className="rounded-lg bg-velo-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-velo-accent/90"
          >
            + Invite member
          </button>
        </div>

        {/* Invite form */}
        {showInviteForm && (
          <div className="mb-4 rounded-lg border border-velo-line bg-velo-inset p-4 space-y-3">
            <p className="text-xs font-semibold text-velo-text">New invite link</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-[11px] font-medium text-velo-muted">Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as InviteRole)}
                  className="w-full rounded border border-velo-line bg-velo-panel px-2 py-1.5 text-xs text-velo-text focus:outline-none focus:ring-1 focus:ring-velo-accent"
                >
                  {ASSIGNABLE_ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-medium text-velo-muted">
                  Restrict to email <span className="text-velo-muted/60">(optional)</span>
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  className="w-full rounded border border-velo-line bg-velo-panel px-2 py-1.5 text-xs text-velo-text placeholder-velo-muted/50 focus:outline-none focus:ring-1 focus:ring-velo-accent"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-medium text-velo-muted">
                Note <span className="text-velo-muted/60">(optional)</span>
              </label>
              <input
                type="text"
                value={inviteNote}
                onChange={(e) => setInviteNote(e.target.value.slice(0, 200))}
                placeholder="e.g. CFO joining next week"
                className="w-full rounded border border-velo-line bg-velo-panel px-2 py-1.5 text-xs text-velo-text placeholder-velo-muted/50 focus:outline-none focus:ring-1 focus:ring-velo-accent"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void createInvite()}
                disabled={creatingInvite}
                className="rounded bg-velo-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-velo-accent/90 disabled:opacity-50"
              >
                {creatingInvite ? 'Creating…' : 'Generate invite link'}
              </button>
              <button
                type="button"
                onClick={() => setShowInviteForm(false)}
                className="text-xs text-velo-muted hover:text-velo-text"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <p className="text-sm text-velo-muted py-4">No one has signed in yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-velo-line">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-velo-line bg-velo-inset/50">
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Member</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Last active</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-velo-line">
                {members.map((m) => {
                  const isSelf = m.email === currentUserEmail;
                  return (
                    <tr key={m.email} className={`${m.revokedAt ? 'opacity-50' : ''}`}>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <Avatar name={m.name} image={m.image} />
                          <div>
                            <div className="font-medium text-velo-text">{m.name ?? m.email}</div>
                            {m.name && <div className="text-[10px] text-velo-muted">{m.email}</div>}
                          </div>
                          {isSelf && (
                            <span className="text-[10px] text-velo-muted">(you)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {m.revokedAt ? (
                          <Badge role={m.role} revoked />
                        ) : m.role === 'founder' || isSelf ? (
                          <Badge role={m.role} />
                        ) : (
                          <select
                            value={m.role}
                            onChange={(e) => void changeRole(m.email, e.target.value as InviteRole)}
                            className="rounded border border-velo-line bg-velo-panel px-1.5 py-0.5 text-[11px] text-velo-text focus:outline-none focus:ring-1 focus:ring-velo-accent"
                            aria-label={`Change role for ${m.email}`}
                          >
                            {ASSIGNABLE_ROLES.map((r) => (
                              <option key={r} value={r}>{ROLE_LABELS[r]}</option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-velo-muted">{relativeTime(m.lastSignIn)}</td>
                      <td className="px-3 py-2.5">
                        {!isSelf && m.role !== 'founder' && (
                          <button
                            type="button"
                            onClick={() => void toggleRevoke(m)}
                            className={`text-[11px] font-medium ${
                              m.revokedAt
                                ? 'text-velo-accent hover:text-velo-accent/70'
                                : 'text-red-500 hover:text-red-700'
                            }`}
                          >
                            {m.revokedAt ? 'Restore access' : 'Revoke access'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-velo-text">Pending invites ({pendingInvites.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-velo-line">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-velo-line bg-velo-inset/50">
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Role</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Scoped to</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Expires</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Note</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted" />
                </tr>
              </thead>
              <tbody className="divide-y divide-velo-line">
                {pendingInvites.map((inv) => (
                  <tr key={inv.token}>
                    <td className="px-3 py-2.5">
                      <Badge role={inv.role} />
                    </td>
                    <td className="px-3 py-2.5 text-velo-muted">{inv.email ?? '—'}</td>
                    <td className="px-3 py-2.5 text-velo-muted">{relativeTime(inv.expiresAt)} (expires)</td>
                    <td className="px-3 py-2.5 text-velo-muted">{inv.note ?? '—'}</td>
                    <td className="px-3 py-2.5">
                      <button
                        type="button"
                        onClick={() => void cancelInvite(inv.token)}
                        className="text-[11px] font-medium text-red-500 hover:text-red-700"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent consumed invites */}
      {consumedInvites.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold text-velo-text">Recently accepted ({consumedInvites.length})</h2>
          <div className="overflow-x-auto rounded-lg border border-velo-line">
            <table className="min-w-full text-xs">
              <thead>
                <tr className="border-b border-velo-line bg-velo-inset/50">
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Accepted by</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">Role granted</th>
                  <th className="px-3 py-2 text-left font-medium text-velo-muted">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-velo-line">
                {consumedInvites.map((inv) => (
                  <tr key={inv.token}>
                    <td className="px-3 py-2.5 text-velo-muted">{inv.consumedBy ?? '—'}</td>
                    <td className="px-3 py-2.5"><Badge role={inv.role} /></td>
                    <td className="px-3 py-2.5 text-velo-muted">
                      {inv.consumedAt ? relativeTime(inv.consumedAt) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
