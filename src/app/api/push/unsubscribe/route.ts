import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pushSubscriptions } from '@/db/schema';
import { unsubscribeSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${userId}:push:unsubscribe`, RATE_LIMITS.pushSubscribe.limit, RATE_LIMITS.pushSubscribe.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  // Scoped to (user_id, endpoint) — a user can only remove their own
  // subscription rows (SR-4 pattern applied to subscriptions too).
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, parsed.data.endpoint)));

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function PATCH() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}
