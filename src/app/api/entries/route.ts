import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and, gte, lte, desc } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createLogEntrySchema, listEntriesQuerySchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects, logEntries } from '@/db/schema';

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

export async function GET(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const query = Object.fromEntries(req.nextUrl.searchParams);
  const parsed = listEntriesQuerySchema.safeParse(query);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid query', details: parsed.error.flatten() }, { status: 400 });
  }
  const { childId, subjectId, from, to } = parsed.data;

  if (!(await assertChildOwnedByFamily(session.familyId, childId))) return notFoundResponse();

  const conditions = [eq(logEntries.childId, childId)];
  if (subjectId) conditions.push(eq(logEntries.subjectId, subjectId));
  if (from) conditions.push(gte(logEntries.entryDate, from));
  if (to) conditions.push(lte(logEntries.entryDate, to));

  const db = getDb();
  const rows = await db
    .select()
    .from(logEntries)
    .where(and(...conditions))
    .orderBy(desc(logEntries.entryDate), desc(logEntries.createdAt));

  return NextResponse.json({ entries: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${session.userId}:entries:POST`, RATE_LIMITS.entriesWrite.limit, RATE_LIMITS.entriesWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = createLogEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const { childId, subjectId } = parsed.data;
  if (!(await assertChildOwnedByFamily(session.familyId, childId))) return notFoundResponse();
  if (subjectId && !(await assertSubjectBelongsToChild(childId, subjectId))) {
    return NextResponse.json({ error: 'subjectId does not belong to this child' }, { status: 400 });
  }

  const db = getDb();
  const [entry] = await db
    .insert(logEntries)
    .values({
      childId,
      subjectId: subjectId ?? null,
      authorUserId: session.userId,
      entryDate: parsed.data.entryDate,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      activityType: parsed.data.activityType,
      externalLink: parsed.data.externalLink ?? null,
    })
    .returning();

  return NextResponse.json({ entry }, { status: 201 });
}
