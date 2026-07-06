import 'server-only';
import NextAuth from 'next-auth';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db/client';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

/**
 * Auth.js configuration (SR-5).
 *
 * - OAuth only (GitHub) — no password is ever stored (A2 shrinks to zero).
 * - Sessions are database-backed and delivered via httpOnly, Secure,
 *   SameSite=Lax cookies (Auth.js default for the `session` cookie in
 *   production; `useSecureCookies` is auto-enabled when AUTH_URL is https).
 * - AUTH_SECRET and the GitHub client secret are read only here, server
 *   side, and never referenced by any client component (SR-1).
 */
export const { handlers, auth, signIn, signOut } = NextAuth(() => {
  return {
    // Adapter requires a live DB; getDb() connects lazily so this factory
    // itself does not throw at import time (keeps `next build` working
    // without a live DATABASE_URL).
    adapter: DrizzleAdapter(getDb(), {
      usersTable: users,
      accountsTable: accounts,
      sessionsTable: sessions,
      verificationTokensTable: verificationTokens,
    }),
    providers: [
      GitHub({
        clientId: process.env.AUTH_GITHUB_ID,
        clientSecret: process.env.AUTH_GITHUB_SECRET,
      }),
    ],
    session: {
      strategy: 'database',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
      // Expose the DB user id on the session object so API routes can use
      // it as the sole source of the session-derived user_id (SR-4).
      session({ session, user }) {
        if (session.user) {
          session.user.id = user.id;
        }
        return session;
      },
    },
    cookies: {
      sessionToken: {
        name: 'authjs.session-token',
        options: {
          httpOnly: true,
          sameSite: 'lax',
          path: '/',
          secure: process.env.NODE_ENV === 'production',
        },
      },
    },
    pages: {
      signIn: '/',
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
  };
});
