import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pushSubscriptions } from '@/db/schema';
import { pushSubscriptionSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${userId}:push:subscribe`, RATE_LIMITS.pushSubscribe.limit, RATE_LIMITS.pushSubscribe.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = pushSubscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid subscription', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null;

  // Upsert on (user_id, endpoint) so a device has exactly one live row
  // (SR-3, T4/T5) — never appended as a duplicate.
  const [existing] = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(and(eq(pushSubscriptions.userId, userId), eq(pushSubscriptions.endpoint, parsed.data.endpoint)));

  if (existing) {
    await db
      .update(pushSubscriptions)
      .set({
        p256dh: parsed.data.keys.p256dh,
        auth: parsed.data.keys.auth,
        userAgent,
        lastSeenAt: new Date(),
      })
      .where(eq(pushSubscriptions.id, existing.id));
  } else {
    await db.insert(pushSubscriptions).values({
      userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      userAgent,
    });
  }

  // Never echo the endpoint or keys back to the client (SR-3).
  return NextResponse.json({ ok: true }, { status: 201 });
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
