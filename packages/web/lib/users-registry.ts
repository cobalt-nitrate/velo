import 'server-only';
import bcrypt from 'bcryptjs';
import { prisma } from './prisma';

const SALT_ROUNDS = 12;

export type UserRole = 'founder' | 'finance_lead' | 'hr_lead' | 'manager' | 'employee';

export const ALL_ROLES: UserRole[] = [
  'founder', 'finance_lead', 'hr_lead', 'manager', 'employee',
];
export const ASSIGNABLE_ROLES: Exclude<UserRole, 'founder'>[] = [
  'finance_lead', 'hr_lead', 'manager', 'employee',
];

export interface UserRecord {
  email: string;
  name: string | null;
  image: string | null;
  role: UserRole;
  firstSignIn: string;
  lastSignIn: string;
  sessionVersion: number;
  revokedAt: string | null;
  revokedBy: string | null;
}

function toRecord(u: {
  email: string | null;
  name: string | null;
  image: string | null;
  role: string;
  firstSignIn: Date;
  lastSignIn: Date;
  sessionVersion: number;
  revokedAt: Date | null;
  revokedBy: string | null;
}): UserRecord {
  return {
    email: u.email ?? '',
    name: u.name,
    image: u.image,
    role: u.role as UserRole,
    firstSignIn: u.firstSignIn.toISOString(),
    lastSignIn: u.lastSignIn.toISOString(),
    sessionVersion: u.sessionVersion,
    revokedAt: u.revokedAt?.toISOString() ?? null,
    revokedBy: u.revokedBy,
  };
}

export async function getAllUsers(): Promise<UserRecord[]> {
  const users = await prisma.user.findMany({
    orderBy: { lastSignIn: 'desc' },
    select: {
      email: true, name: true, image: true, role: true,
      firstSignIn: true, lastSignIn: true,
      sessionVersion: true, revokedAt: true, revokedBy: true,
    },
  });
  return users.map(toRecord);
}

export async function getUser(email: string): Promise<UserRecord | null> {
  if (!email) return null;
  const u = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: {
      email: true, name: true, image: true, role: true,
      firstSignIn: true, lastSignIn: true,
      sessionVersion: true, revokedAt: true, revokedBy: true,
    },
  });
  return u ? toRecord(u) : null;
}

export async function isRevoked(email: string): Promise<boolean> {
  if (!email) return false;
  const u = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    select: { revokedAt: true },
  });
  return u?.revokedAt != null;
}

export async function revokeUser(email: string, revokedBy: string): Promise<UserRecord | null> {
  try {
    const u = await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        revokedAt: new Date(),
        revokedBy,
        sessionVersion: { increment: 1 },
      },
      select: {
        email: true, name: true, image: true, role: true,
        firstSignIn: true, lastSignIn: true,
        sessionVersion: true, revokedAt: true, revokedBy: true,
      },
    });
    return toRecord(u);
  } catch {
    return null;
  }
}

export async function createUser(params: {
  email: string;
  name: string | null;
  password: string;
  role?: string;
}): Promise<UserRecord> {
  const email = params.email.toLowerCase().trim();
  const passwordHash = await bcrypt.hash(params.password, SALT_ROUNDS);
  const u = await prisma.user.create({
    data: {
      email,
      name: params.name,
      passwordHash,
      role: params.role ?? 'employee',
      firstSignIn: new Date(),
      lastSignIn: new Date(),
    },
    select: {
      email: true, name: true, image: true, role: true,
      firstSignIn: true, lastSignIn: true,
      sessionVersion: true, revokedAt: true, revokedBy: true,
    },
  });
  return toRecord(u);
}

export async function setPassword(email: string, password: string): Promise<void> {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  await prisma.user.update({
    where: { email: email.toLowerCase().trim() },
    data: { passwordHash, sessionVersion: { increment: 1 } },
  });
}

export async function unrevokeUser(email: string): Promise<UserRecord | null> {
  try {
    const u = await prisma.user.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        revokedAt: null,
        revokedBy: null,
        sessionVersion: { increment: 1 },
      },
      select: {
        email: true, name: true, image: true, role: true,
        firstSignIn: true, lastSignIn: true,
        sessionVersion: true, revokedAt: true, revokedBy: true,
      },
    });
    return toRecord(u);
  } catch {
    return null;
  }
}
