import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { users } from '@/db/schema';
import { updateSettingsSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Quiet-hours / timezone settings (PLAN.md section 5, step 10). Scoped
// strictly to the session user (SR-4) — there is no id param to spoof.

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const db = getDb();
  const [row] = await db
    .select({
      timezone: users.timezone,
      quietHoursStart: users.quietHoursStart,
      quietHoursEnd: users.quietHoursEnd,
    })
    .from(users)
    .where(eq(users.id, userId));

  return NextResponse.json({ settings: row ?? null });
}

export async function PATCH(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${userId}:settings:PATCH`, RATE_LIMITS.habitsWrite.limit, RATE_LIMITS.habitsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set({
      timezone: parsed.data.timezone,
      quietHoursStart: parsed.data.quietHoursStart,
      quietHoursEnd: parsed.data.quietHoursEnd,
    })
    .where(eq(users.id, userId))
    .returning({
      timezone: users.timezone,
      quietHoursStart: users.quietHoursStart,
      quietHoursEnd: users.quietHoursEnd,
    });

  return NextResponse.json({ settings: updated });
}

export async function POST() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}
