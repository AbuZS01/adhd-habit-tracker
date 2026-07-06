import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { habits } from '@/db/schema';
import { createHabitSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// Same-origin only; no CORS headers are set, so cross-origin browser
// requests are blocked by default (SR-10). Only GET/POST are exported, so
// any other method receives Next.js's built-in 405.

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const db = getDb();
  // Scoped strictly to the session user (SR-4).
  const rows = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.isArchived, false)));

  return NextResponse.json({ habits: rows });
}

export async function POST(request: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${userId}:habits:POST`, RATE_LIMITS.habitsWrite.limit, RATE_LIMITS.habitsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [created] = await db
    .insert(habits)
    .values({
      userId, // server-derived, never from client body (SR-4)
      name: parsed.data.name,
      cue: parsed.data.cue ?? null,
      note: parsed.data.note ?? null,
      scheduleTime: parsed.data.scheduleTime,
      activeDays: parsed.data.activeDays,
    })
    .returning();

  return NextResponse.json({ habit: created }, { status: 201 });
}

export async function PUT() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}

export async function PATCH() {
  return methodNotAllowedResponse();
}
