import bcrypt from 'bcryptjs';
import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from './prisma';

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.toLowerCase().trim();

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            passwordHash: true,
            revokedAt: true,
            sessionVersion: true,
          },
        });

        if (!user?.passwordHash) return null;
        if (user.revokedAt) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Update role + lastSignIn on each successful sign-in
        await prisma.user.update({
          where: { email },
          data: {
            role: resolveRole(email),
            lastSignIn: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          sessionVersion: user.sessionVersion,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: embed identity into the JWT
        token.id = user.id;
        token.actor_role = resolveRole(user.email ?? '');
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 1;
        return token;
      }

      // Subsequent requests: re-validate against DB for revocation + role changes
      if (!token.id) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { revokedAt: true, sessionVersion: true, email: true },
      });

      if (!dbUser || dbUser.revokedAt || dbUser.sessionVersion !== token.sessionVersion) {
        // Token is stale or user is revoked — strip it so session returns null
        return { revoked: true };
      }

      // Re-resolve role from env vars so VELO_*_EMAILS changes propagate immediately
      token.actor_role = resolveRole(dbUser.email);
      return token;
    },

    async session({ session, token }) {
      // Stripped token (revoked / session invalidated)
      if ((token as { revoked?: boolean }).revoked || !token.id) {
        return { ...session, user: null as never };
      }

      (session.user as { id?: string }).id = token.id as string;
      (session.user as { actor_role?: string }).actor_role = token.actor_role as string;

      return session;
    },
  },

  pages: {
    signIn: '/auth/signin',
  },
};

// ─── Role resolution ─────────────────────────────────────────────────────────

export function resolveRole(email: string): string {
  const e = email.toLowerCase().trim();
  if (splitEmails(process.env.VELO_FOUNDER_EMAILS ?? '').has(e)) return 'founder';
  if (splitEmails(process.env.VELO_FINANCE_EMAILS ?? '').has(e)) return 'finance_lead';
  if (splitEmails(process.env.VELO_HR_EMAILS ?? '').has(e)) return 'hr_lead';
  if (splitEmails(process.env.VELO_MANAGER_EMAILS ?? '').has(e)) return 'manager';
  return 'employee';
}

function splitEmails(raw: string): Set<string> {
  return new Set(
    raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
  );
}
