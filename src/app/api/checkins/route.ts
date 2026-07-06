import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { checkins, habits, users } from '@/db/schema';
import { createCheckinSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, notFoundResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { computeStreak } from '@/lib/streak';

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${userId}:checkins:POST`, RATE_LIMITS.checkinsWrite.limit, RATE_LIMITS.checkinsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createCheckinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  // Verify the habit belongs to the session user BEFORE inserting a
  // check-in for it (SR-4/T1) — only a habitId is accepted from the
  // client; user_id always comes from the session.
  const [habit] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, parsed.data.habitId), eq(habits.userId, userId)));

  if (!habit) return notFoundResponse();

  await db.insert(checkins).values({
    habitId: parsed.data.habitId,
    userId,
  });

  // Recompute streak server-side from stored rows — never trust a client
  // supplied streak number.
  const [userRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId));
  const timeZone = userRow?.timezone ?? 'UTC';

  const habitCheckins = await db
    .select({ checkedAt: checkins.checkedAt })
    .from(checkins)
    .where(and(eq(checkins.habitId, parsed.data.habitId), eq(checkins.userId, userId)));

  const streak = computeStreak(
    habitCheckins.map((c) => c.checkedAt),
    timeZone
  );

  return NextResponse.json({ ok: true, streak }, { status: 201 });
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
