import 'server-only';
import { randomBytes } from 'crypto';
import { prisma } from './prisma';
import type { ASSIGNABLE_ROLES } from './users-registry';

export type InviteRole = (typeof ASSIGNABLE_ROLES)[number];
export const ALLOWED_INVITE_ROLES: InviteRole[] = ['finance_lead', 'hr_lead', 'manager', 'employee'];

const TOKEN_REGEX = /^[0-9a-f]{64}$/;
const INVITE_TTL_HOURS = 48;

export interface InviteRecord {
  token: string;
  role: InviteRole;
  email: string | null;
  note: string | null;
  createdAt: string;
  expiresAt: string;
  createdBy: string;
  consumedAt: string | null;
  consumedBy: string | null;
}

function toRecord(inv: {
  token: string;
  role: string;
  email: string | null;
  note: string | null;
  createdAt: Date;
  expiresAt: Date;
  createdBy: { email: string | null };
  consumedAt: Date | null;
  consumedBy: string | null;
}): InviteRecord {
  return {
    token: inv.token,
    role: inv.role as InviteRole,
    email: inv.email,
    note: inv.note,
    createdAt: inv.createdAt.toISOString(),
    expiresAt: inv.expiresAt.toISOString(),
    createdBy: inv.createdBy.email ?? '',
    consumedAt: inv.consumedAt?.toISOString() ?? null,
    consumedBy: inv.consumedBy,
  };
}

const WITH_CREATOR = { createdBy: { select: { email: true } } } as const;

export async function createInvite(
  role: InviteRole,
  createdByEmail: string,
  email: string | null = null,
  note: string | null = null
): Promise<InviteRecord> {
  if (!ALLOWED_INVITE_ROLES.includes(role)) {
    throw new Error(`Invite role '${role}' is not permitted.`);
  }
  const creator = await prisma.user.findUnique({ where: { email: createdByEmail }, select: { id: true } });
  if (!creator) throw new Error('Inviting user not found in database.');

  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 3_600_000);

  const inv = await prisma.invite.create({
    data: {
      token,
      role,
      email: email ? email.toLowerCase().trim() : null,
      note: note ? String(note).slice(0, 300).trim() : null,
      expiresAt,
      createdById: creator.id,
    },
    include: WITH_CREATOR,
  });
  return toRecord(inv);
}

export async function getInvite(token: string): Promise<InviteRecord | null> {
  if (!TOKEN_REGEX.test(token)) return null;
  const inv = await prisma.invite.findUnique({
    where: { token },
    include: WITH_CREATOR,
  });
  return inv ? toRecord(inv) : null;
}

export async function listInvites(): Promise<InviteRecord[]> {
  const now = new Date();
  const auditCutoff = new Date(Date.now() - 30 * 24 * 3_600_000);

  // Prune expired+unconsumed and old consumed records
  await prisma.invite.deleteMany({
    where: {
      OR: [
        { consumedAt: null, expiresAt: { lt: now } },
        { consumedAt: { not: null, lt: auditCutoff } },
      ],
    },
  });

  const invites = await prisma.invite.findMany({
    orderBy: { createdAt: 'desc' },
    include: WITH_CREATOR,
  });
  return invites.map(toRecord);
}

export async function consumeInvite(token: string, consumedBy: string): Promise<InviteRecord | null> {
  if (!TOKEN_REGEX.test(token)) return null;
  const email = consumedBy.toLowerCase().trim();

  try {
    const inv = await prisma.invite.findUnique({
      where: { token },
      include: WITH_CREATOR,
    });
    if (!inv) return null;
    if (inv.consumedAt) return null;
    if (inv.expiresAt < new Date()) return null;
    if (inv.email && inv.email !== email) return null;

    const updated = await prisma.invite.update({
      where: { token },
      data: { consumedAt: new Date(), consumedBy: email },
      include: WITH_CREATOR,
    });
    return toRecord(updated);
  } catch {
    return null;
  }
}

export async function deleteInvite(token: string): Promise<{ deleted: boolean; reason?: string }> {
  if (!TOKEN_REGEX.test(token)) return { deleted: false, reason: 'invalid_token' };
  try {
    const inv = await prisma.invite.findUnique({ where: { token }, select: { consumedAt: true } });
    if (!inv) return { deleted: false, reason: 'not_found' };
    if (inv.consumedAt) return { deleted: false, reason: 'already_consumed' };
    await prisma.invite.delete({ where: { token } });
    return { deleted: true };
  } catch {
    return { deleted: false, reason: 'error' };
  }
}
