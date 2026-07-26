import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createPlannedActivitySchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects, plannedActivities } from '@/db/schema';

async function assertChildOwnedByFamily(familyId: string, childId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  return Boolean(row);
}

async function assertSubjectBelongsToChild(childId: string, subjectId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: subjects.id })
    .from(subjects)
    .where(and(eq(subjects.id, subjectId), eq(subjects.childId, childId)));
  return Boolean(row);
}

export async function POST(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${session.userId}:planner:POST`, RATE_LIMITS.plannerWrite.limit, RATE_LIMITS.plannerWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = createPlannedActivitySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { childId, subjectId } = parsed.data;
  if (!(await assertChildOwnedByFamily(session.familyId, childId))) return notFoundResponse();
  if (subjectId && !(await assertSubjectBelongsToChild(childId, subjectId))) {
    return NextResponse.json({ error: 'subjectId does not belong to this child' }, { status: 400 });
  }

  const db = getDb();
  const [planned] = await db
    .insert(plannedActivities)
    .values({
      childId,
      subjectId: subjectId ?? null,
      plannedDate: parsed.data.plannedDate,
      title: parsed.data.title ?? null,
      createdByUserId: session.userId,
    })
    .returning();

  return NextResponse.json({ plannedActivity: planned }, { status: 201 });
}
