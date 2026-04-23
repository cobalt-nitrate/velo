import { withAuth } from 'next-auth/middleware';

/**
 * Gate **page** routes so deep-links and URL edits cannot view the app without a session.
 * APIs under `/api/*` keep their own `getServerSession` checks so JSON responses are not
 * replaced by HTML redirects from middleware.
 *
 * Public UI: `/auth/*`, `/team/invite` (invite redemption).
 */
export default withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const p = req.nextUrl.pathname;
      if (p.startsWith('/auth')) return true;
      if (p.startsWith('/team/invite')) return true;
      if (p.startsWith('/api')) return true;

      if (!token) return false;
      if ((token as { revoked?: boolean }).revoked) return false;
      return true;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
});

export const config = {
  matcher: [
    /*
     * Run on all paths except Next internals and static files (images, etc.).
     * Public routes are handled in `authorized` above.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
