import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { idParamSchema, updatePlannedActivitySchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, plannedActivities } from '@/db/schema';

async function loadOwnedPlannedActivity(familyId: string, id: string) {
  const db = getDb();
  const [row] = await db
    .select({ plannedActivity: plannedActivities })
    .from(plannedActivities)
    .innerJoin(children, eq(children.id, plannedActivities.childId))
    .where(and(eq(plannedActivities.id, id), eq(children.familyId, familyId)));
  return row?.plannedActivity ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedPlannedActivity(session.familyId, id);
  if (!existing) return notFoundResponse();

  const rl = checkRateLimit(`user:${session.userId}:planner:PATCH`, RATE_LIMITS.plannerWrite.limit, RATE_LIMITS.plannerWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = updatePlannedActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(plannedActivities)
    .set({ completedAt: parsed.data.completed ? new Date() : null })
    .where(eq(plannedActivities.id, id))
    .returning();

  return NextResponse.json({ plannedActivity: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedPlannedActivity(session.familyId, id);
  if (!existing) return notFoundResponse();

  const db = getDb();
  await db.delete(plannedActivities).where(eq(plannedActivities.id, id));

  return NextResponse.json({ ok: true });
}
