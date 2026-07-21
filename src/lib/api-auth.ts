import 'server-only';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { requireSessionFamily, type SessionFamily } from '@/lib/family';

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

/**
 * Resolves the current session's family membership. Every protected API
 * route that reads/writes children, subjects, or log entries must call
 * this and scope its query by the returned `familyId` — never by a
 * client-supplied id (equivalent of SR-4 for this app's tenancy model).
 */
export async function requireFamily(): Promise<SessionFamily | null> {
  return requireSessionFamily();
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
