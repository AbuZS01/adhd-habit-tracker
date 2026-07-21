import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { del } from '@vercel/blob';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, logEntries, attachments } from '@/db/schema';

async function loadOwnedAttachment(familyId: string, attachmentId: string) {
  const db = getDb();
  const [row] = await db
    .select({ attachment: attachments })
    .from(attachments)
    .innerJoin(logEntries, eq(logEntries.id, attachments.logEntryId))
    .innerJoin(children, eq(children.id, logEntries.childId))
    .where(and(eq(attachments.id, attachmentId), eq(children.familyId, familyId)));
  return row?.attachment ?? null;
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const rl = checkRateLimit(
    `user:${session.userId}:attachments:DELETE`,
    RATE_LIMITS.attachmentsWrite.limit,
    RATE_LIMITS.attachmentsWrite.windowMs
  );
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const existing = await loadOwnedAttachment(session.familyId, id);
  if (!existing) return notFoundResponse();

  await del(existing.pathname).catch(() => undefined);

  const db = getDb();
  await db.delete(attachments).where(eq(attachments.id, id));

  return NextResponse.json({ ok: true });
}
