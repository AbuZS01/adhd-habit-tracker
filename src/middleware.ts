import { NextResponse, type NextRequest } from 'next/server';

/**
 * Two jobs, both per-request:
 *
 * 1. A lightweight, Edge-compatible defense-in-depth guard for /api/**
 *    (SR-5). This does NOT import src/lib/auth.ts: Auth.js is configured
 *    with a *database* session strategy, whose Drizzle adapter requires the
 *    `postgres` Node.js driver — a driver that cannot run in the Edge
 *    runtime Middleware uses by default. This performs a cheap,
 *    non-authoritative presence check on the session cookie: requests with
 *    no session cookie at all are rejected immediately. The AUTHORITATIVE
 *    check is `requireUserId()`/`requireFamily()` (src/lib/api-auth.ts),
 *    called at the top of every protected route handler.
 *
 * 2. A per-request CSP nonce. Next.js's App Router injects small inline
 *    `<script>` tags to stream server-rendered data to the client bundle —
 *    a strict `script-src 'self'` with no `unsafe-inline` blocks those
 *    outright and breaks all client-side hydration. The fix (per Next.js's
 *    documented CSP pattern) is a per-request nonce: middleware generates
 *    one, puts it in the CSP response header, and Next.js automatically
 *    stamps that same nonce onto its own inline scripts when it detects
 *    the header. `next.config.mjs` intentionally does NOT set
 *    Content-Security-Policy — it must vary per request, so it can only
 *    live here.
 */

const SESSION_COOKIE_NAMES = ['authjs.session-token', '__Secure-authjs.session-token'];

function hasSessionCookie(req: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => req.cookies.has(name));
}

function buildCsp(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    // Only the upload *token* comes from our own API
    // (/api/attachments/upload) — the file bytes themselves are PUT
    // directly from the browser to Vercel's blob API
    // (https://vercel.com/api/blob, confirmed from the @vercel/blob
    // source rather than assumed — this is exactly the class of bug the
    // script-src nonce fix caught earlier), which then stores the blob at
    // a per-store *.blob.vercel-storage.com URL. Attachment reads never
    // hit either origin from the browser: the app only ever displays
    // files via our own authenticated proxy route.
    "connect-src 'self' https://vercel.com https://*.blob.vercel-storage.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isApiRoute = pathname.startsWith('/api/');
  const isAuthRoute = pathname.startsWith('/api/auth/');

  if (isApiRoute && !isAuthRoute && !hasSessionCookie(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', buildCsp(nonce));
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
