// Shared Prisma singleton for @velo/tools data plane.
// Uses the same DATABASE_URL as packages/web. In the Next.js server process,
// both clients share the underlying Postgres connection pool.

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { _veloToolsPrisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma._veloToolsPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma._veloToolsPrisma = prisma;
}

