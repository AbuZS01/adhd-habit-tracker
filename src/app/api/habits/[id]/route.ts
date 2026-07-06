import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { habits } from '@/db/schema';
import { updateHabitSchema, habitIdParamSchema } from '@/lib/validation';
import { requireUserId, unauthorizedResponse, notFoundResponse, methodNotAllowedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  const idParsed = habitIdParamSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: 'Invalid habit id' }, { status: 400 });

  const rl = checkRateLimit(`user:${userId}:habits:PATCH`, RATE_LIMITS.habitsWrite.limit, RATE_LIMITS.habitsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = updateHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  // Ownership check BEFORE acting (SR-4/T1): the WHERE clause requires both
  // the id AND the session-derived user_id to match, so a habit belonging
  // to another user returns zero rows (404), never a cross-user write.
  const [existing] = await db
    .select({ id: habits.id })
    .from(habits)
    .where(and(eq(habits.id, idParsed.data), eq(habits.userId, userId)));

  if (!existing) return notFoundResponse();

  const updateData: Partial<typeof habits.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.cue !== undefined) updateData.cue = parsed.data.cue;
  if (parsed.data.note !== undefined) updateData.note = parsed.data.note;
  if (parsed.data.scheduleTime !== undefined) updateData.scheduleTime = parsed.data.scheduleTime;
  if (parsed.data.activeDays !== undefined) updateData.activeDays = parsed.data.activeDays;
  if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

  const [updated] = await db
    .update(habits)
    .set(updateData)
    .where(and(eq(habits.id, idParsed.data), eq(habits.userId, userId)))
    .returning();

  return NextResponse.json({ habit: updated });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const { id } = await params;
  const idParsed = habitIdParamSchema.safeParse(id);
  if (!idParsed.success) return NextResponse.json({ error: 'Invalid habit id' }, { status: 400 });

  const rl = checkRateLimit(`user:${userId}:habits:DELETE`, RATE_LIMITS.habitsWrite.limit, RATE_LIMITS.habitsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const db = getDb();

  // Ownership-scoped delete (SR-4): a non-owned id matches zero rows.
  const [deleted] = await db
    .delete(habits)
    .where(and(eq(habits.id, idParsed.data), eq(habits.userId, userId)))
    .returning({ id: habits.id });

  if (!deleted) return notFoundResponse();

  return NextResponse.json({ ok: true });
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function POST() {
  return methodNotAllowedResponse();
}
