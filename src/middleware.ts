import { NextResponse, type NextRequest } from 'next/server';

/**
 * Lightweight, Edge-compatible defense-in-depth guard for /api/** (SR-5).
 *
 * This middleware intentionally does NOT import src/lib/auth.ts: Auth.js
 * is configured with a *database* session strategy (SR-5), whose Drizzle
 * adapter requires the `postgres` Node.js driver — a driver that cannot
 * run in the Edge runtime that Next.js Middleware uses by default. Fully
 * validating a database session here would require either the Node.js
 * middleware runtime (still experimental in this Next.js version) or a
 * separate JWT-based auth config, neither of which the plan called for.
 *
 * Instead, middleware performs a cheap, non-authoritative presence check
 * on the session cookie: requests with no session cookie at all are
 * rejected immediately (cuts off the most common abuse case — no cookie
 * whatsoever — before it reaches any route). The AUTHORITATIVE check is
 * `requireUserId()` (src/lib/api-auth.ts), called at the top of every
 * protected route handler, which fully validates the session against the
 * database and is what SR-5's "Met" bar (401 with no valid session)
 * actually depends on. See PLAN.md SR-5 and SR-4.
 */

const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isAuthRoute = pathname.startsWith('/api/auth/');
  const isCronRoute = pathname.startsWith('/api/cron/');

  if (!isAuthRoute && !isCronRoute && !hasSessionCookie(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
