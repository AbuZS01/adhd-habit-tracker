import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse } from '@/lib/api-auth';
import { idParamSchema } from '@/lib/validation';
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
