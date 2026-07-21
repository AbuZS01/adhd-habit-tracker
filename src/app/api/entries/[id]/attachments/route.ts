import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createAttachmentSchema, idParamSchema, ATTACHMENT_MAX_PER_ENTRY } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, logEntries, attachments } from '@/db/schema';

async function loadOwnedEntry(familyId: string, entryId: string) {
  const db = getDb();
  const [row] = await db
    .select({ entry: logEntries })
    .from(logEntries)
    .innerJoin(children, eq(children.id, logEntries.childId))
    .where(and(eq(logEntries.id, entryId), eq(children.familyId, familyId)));
  return row?.entry ?? null;
}

/**
 * Persists a record of a file already uploaded to Vercel Blob (via
 * `/api/attachments/upload`, which is the actual authorization gate — this
 * route just confirms the DB is told about it). If somehow called with a
 * pathname the caller doesn't actually own, the blob it points to still
 * required a token scoped to this exact entry to have been written, so
 * there is no way to attach someone else's file by guessing an id here.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id: entryId } = await params;
  if (!idParamSchema.safeParse(entryId).success) return notFoundResponse();

  const rl = checkRateLimit(
    `user:${session.userId}:attachments:POST`,
    RATE_LIMITS.attachmentsWrite.limit,
    RATE_LIMITS.attachmentsWrite.windowMs
  );
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const entry = await loadOwnedEntry(session.familyId, entryId);
  if (!entry) return notFoundResponse();

  const body = await req.json().catch(() => null);
  const parsed = createAttachmentSchema.safeParse({ ...body, logEntryId: entryId });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  if (!parsed.data.pathname.startsWith(`entries/${entryId}/`)) {
    return NextResponse.json({ error: 'pathname does not match this entry' }, { status: 400 });
  }

  const db = getDb();
  const existing = await db.select({ id: attachments.id }).from(attachments).where(eq(attachments.logEntryId, entryId));
  if (existing.length >= ATTACHMENT_MAX_PER_ENTRY) {
    // Clean up the blob we're refusing to record, so it doesn't linger orphaned.
    await del(parsed.data.pathname).catch(() => undefined);
    return NextResponse.json({ error: `A log entry can have at most ${ATTACHMENT_MAX_PER_ENTRY} attachments` }, { status: 400 });
  }

  const [attachment] = await db
    .insert(attachments)
    .values({
      logEntryId: entryId,
      pathname: parsed.data.pathname,
      originalName: parsed.data.originalName,
      contentType: parsed.data.contentType,
      size: parsed.data.size,
      uploadedByUserId: session.userId,
    })
    .returning();

  return NextResponse.json({ attachment }, { status: 201 });
}
