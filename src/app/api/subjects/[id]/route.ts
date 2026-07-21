import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { updateSubjectSchema, idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects } from '@/db/schema';

// Subjects belong to a child, which belongs to a family — ownership is
// verified by joining through children rather than trusting a bare
// subject id (a subject id from another family must 404, not leak/update).
async function loadOwnedSubject(familyId: string, subjectId: string) {
  const db = getDb();
  const [row] = await db
    .select({ subject: subjects })
    .from(subjects)
    .innerJoin(children, eq(children.id, subjects.childId))
    .where(and(eq(subjects.id, subjectId), eq(children.familyId, familyId)));
  return row?.subject ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const rl = checkRateLimit(`user:${session.userId}:subjects:PATCH`, RATE_LIMITS.subjectsWrite.limit, RATE_LIMITS.subjectsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const existing = await loadOwnedSubject(session.familyId, id);
  if (!existing) return notFoundResponse();

  const body = await req.json().catch(() => null);
  const parsed = updateSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db.update(subjects).set(parsed.data).where(eq(subjects.id, id)).returning();

  return NextResponse.json({ subject: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedSubject(session.familyId, id);
  if (!existing) return notFoundResponse();

  const db = getDb();
  const [updated] = await db
    .update(subjects)
    .set({ isArchived: true })
    .where(eq(subjects.id, id))
    .returning();

  return NextResponse.json({ subject: updated });
}
