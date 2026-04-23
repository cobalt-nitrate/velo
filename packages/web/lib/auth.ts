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
            role: true,
          },
        });

        if (!user?.passwordHash) return null;
        if (user.revokedAt) return null;

        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;

        // Update lastSignIn on each successful sign-in
        await prisma.user.update({
          where: { email },
          data: {
            lastSignIn: new Date(),
          },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          sessionVersion: user.sessionVersion,
          role: user.role,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        // Initial sign-in: embed identity into the JWT
        token.id = user.id;
        token.actor_role = (user as { role?: string }).role ?? 'employee';
        token.sessionVersion = (user as { sessionVersion?: number }).sessionVersion ?? 1;
        return token;
      }

      // Subsequent requests: re-validate against DB for revocation + role/version changes
      if (!token.id) return token;

      const dbUser = await prisma.user.findUnique({
        where: { id: token.id as string },
        select: { revokedAt: true, sessionVersion: true, role: true },
      });

      if (!dbUser || dbUser.revokedAt || dbUser.sessionVersion !== token.sessionVersion) {
        // Token is stale or user is revoked — strip it so session returns null
        return { revoked: true };
      }

      // Canonical role comes from DB
      token.actor_role = dbUser.role ?? 'employee';
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

export const ROLE_LABELS: Record<string, string> = {
  founder: 'Founder',
  finance_lead: 'Finance Lead',
  hr_lead: 'HR Lead',
  manager: 'Manager',
  employee: 'Employee',
};
