import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      // Attach actor_role based on email allowlist in env
      // VELO_FOUNDER_EMAILS, VELO_FINANCE_EMAILS, VELO_HR_EMAILS (comma-separated)
      if (session.user?.email) {
        (session.user as { actor_role?: string }).actor_role = resolveRole(session.user.email);
      }
      return session;
    },
    async jwt({ token }) {
      return token;
    },
    async signIn({ user }) {
      // Restrict sign-in to allowed domains if configured
      const allowedDomain = process.env.VELO_ALLOWED_DOMAIN;
      if (allowedDomain && user.email) {
        return user.email.endsWith(`@${allowedDomain}`);
      }
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  session: {
    strategy: 'jwt',
  },
};

function resolveRole(email: string): string {
  const founderEmails = (process.env.VELO_FOUNDER_EMAILS ?? '').split(',').map((e) => e.trim());
  const financeEmails = (process.env.VELO_FINANCE_EMAILS ?? '').split(',').map((e) => e.trim());
  const hrEmails = (process.env.VELO_HR_EMAILS ?? '').split(',').map((e) => e.trim());

  if (founderEmails.includes(email)) return 'founder';
  if (financeEmails.includes(email)) return 'finance_lead';
  if (hrEmails.includes(email)) return 'hr_lead';
  return 'employee';
}
