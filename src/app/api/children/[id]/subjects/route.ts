import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and, desc } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createSubjectSchema, idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects } from '@/db/schema';

async function assertChildOwnedByFamily(familyId: string, childId: string) {
  const db = getDb();
  const [row] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  return Boolean(row);
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id: childId } = await params;
  if (!idParamSchema.safeParse(childId).success) return notFoundResponse();
  if (!(await assertChildOwnedByFamily(session.familyId, childId))) return notFoundResponse();

  const db = getDb();
  const rows = await db
    .select()
    .from(subjects)
    .where(and(eq(subjects.childId, childId), eq(subjects.isArchived, false)))
    .orderBy(subjects.sortOrder, subjects.createdAt);

  return NextResponse.json({ subjects: rows });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id: childId } = await params;
  if (!idParamSchema.safeParse(childId).success) return notFoundResponse();
  if (!(await assertChildOwnedByFamily(session.familyId, childId))) return notFoundResponse();

  const rl = checkRateLimit(`user:${session.userId}:subjects:POST`, RATE_LIMITS.subjectsWrite.limit, RATE_LIMITS.subjectsWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = createSubjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const existing = await db
    .select({ name: subjects.name })
    .from(subjects)
    .where(and(eq(subjects.childId, childId), eq(subjects.isArchived, false)));

  const normalized = parsed.data.name.trim().toLowerCase();
  if (existing.some((s) => s.name.trim().toLowerCase() === normalized)) {
    return NextResponse.json({ error: 'That subject already exists.' }, { status: 409 });
  }

  const [top] = await db
    .select({ sortOrder: subjects.sortOrder })
    .from(subjects)
    .where(eq(subjects.childId, childId))
    .orderBy(desc(subjects.sortOrder))
    .limit(1);

  const [subject] = await db
    .insert(subjects)
    .values({ childId, name: parsed.data.name, sortOrder: (top?.sortOrder ?? -1) + 1 })
    .returning();

  return NextResponse.json({ subject }, { status: 201 });
}
