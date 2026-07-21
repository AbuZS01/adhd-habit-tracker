import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { updateLogEntrySchema, idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects, logEntries, attachments } from '@/db/schema';

async function loadOwnedEntry(familyId: string, entryId: string) {
  const db = getDb();
  const [row] = await db
    .select({ entry: logEntries })
    .from(logEntries)
    .innerJoin(children, eq(children.id, logEntries.childId))
    .where(and(eq(logEntries.id, entryId), eq(children.familyId, familyId)));
  return row?.entry ?? null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const rl = checkRateLimit(`user:${session.userId}:entries:PATCH`, RATE_LIMITS.entriesWrite.limit, RATE_LIMITS.entriesWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const existing = await loadOwnedEntry(session.familyId, id);
  if (!existing) return notFoundResponse();

  const body = await req.json().catch(() => null);
  const parsed = updateLogEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();

  if (parsed.data.subjectId) {
    const [subjectRow] = await db
      .select({ id: subjects.id })
      .from(subjects)
      .where(and(eq(subjects.id, parsed.data.subjectId), eq(subjects.childId, existing.childId)));
    if (!subjectRow) {
      return NextResponse.json({ error: 'subjectId does not belong to this child' }, { status: 400 });
    }
  }

  const [updated] = await db
    .update(logEntries)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(logEntries.id, id))
    .returning();

  return NextResponse.json({ entry: updated });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedEntry(session.familyId, id);
  if (!existing) return notFoundResponse();

  const db = getDb();

  // Blob files aren't cascade-deleted by the DB FK — clean them up
  // explicitly before removing the entry (whose row cascade-deletes the
  // attachment records themselves).
  const entryAttachments = await db
    .select({ pathname: attachments.pathname })
    .from(attachments)
    .where(eq(attachments.logEntryId, id));
  await Promise.all(entryAttachments.map((a) => del(a.pathname).catch(() => undefined)));

  await db.delete(logEntries).where(eq(logEntries.id, id));

  return NextResponse.json({ ok: true });
}
