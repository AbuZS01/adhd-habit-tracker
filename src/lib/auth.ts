import 'server-only';
import NextAuth from 'next-auth';
import type { Provider } from 'next-auth/providers';
import Nodemailer from 'next-auth/providers/nodemailer';
import GitHub from 'next-auth/providers/github';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { getDb } from '@/db/client';
import { users, accounts, sessions, verificationTokens } from '@/db/schema';

/**
 * Auth.js configuration.
 *
 * - Email magic-link (Nodemailer provider) is the primary sign-in method:
 *   most guardians using this app will not have a GitHub account, so
 *   passwordless email is the realistic default. GitHub OAuth is kept as an
 *   optional secondary provider and only registers if its env vars are set.
 * - No password is ever stored (A2 shrinks to zero).
 * - Sessions are database-backed and delivered via httpOnly, Secure,
 *   SameSite=Lax cookies (Auth.js default for the `session` cookie in
 *   production; `useSecureCookies` is auto-enabled when AUTH_URL is https).
 * - All secrets (AUTH_SECRET, SMTP credentials, GitHub client secret) are
 *   read only here, server side, and never referenced by any client
 *   component.
 */
const providers: Provider[] = [];

if (process.env.EMAIL_SERVER && process.env.EMAIL_FROM) {
  providers.push(
    Nodemailer({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    })
  );
}

if (process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET) {
  providers.push(
    GitHub({
      clientId: process.env.AUTH_GITHUB_ID,
      clientSecret: process.env.AUTH_GITHUB_SECRET,
    })
  );
}

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
    providers,
    session: {
      strategy: 'database',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    callbacks: {
      // Expose the DB user id on the session object so server code can use
      // it as the sole source of truth for the current guardian's identity.
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
      verifyRequest: '/verify-request',
    },
    secret: process.env.AUTH_SECRET,
    trustHost: true,
  };
});
