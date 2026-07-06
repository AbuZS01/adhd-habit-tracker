import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

/**
 * Resolves the current session and returns the session-derived user id.
 * Every protected API route must call this and bail out on `null` (SR-5).
 * The user id returned here is the ONLY source of truth for `user_id` in
 * any subsequent DB query — it is never taken from a client-supplied body
 * field or query param (SR-4).
 */
export async function requireUserId(): Promise<string | null> {
  const session = await auth();
  const userId = session?.user?.id;
  return typeof userId === 'string' && userId.length > 0 ? userId : null;
}

export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

export function notFoundResponse() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export function methodNotAllowedResponse() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

export function rateLimitedResponse(retryAfterSeconds: number) {
  return NextResponse.json(
    { error: 'Too many requests' },
    { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
  );
}
