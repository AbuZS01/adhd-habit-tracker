import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { get } from '@vercel/blob';
import { requireFamily, unauthorizedResponse, notFoundResponse } from '@/lib/api-auth';
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

/**
 * The only place a private evidence file's bytes are ever served from.
 * Blobs are written with `access: 'private'` — there is no bare URL that
 * reaches them; every read goes through this ownership check first.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const attachment = await loadOwnedAttachment(session.familyId, id);
  if (!attachment) return notFoundResponse();

  const result = await get(attachment.pathname, { access: 'private' });
  if (!result || result.statusCode !== 200) return notFoundResponse();

  return new NextResponse(result.stream, {
    headers: {
      'Content-Type': attachment.contentType,
      'Content-Length': String(attachment.size),
      'Content-Disposition': `inline; filename="${encodeURIComponent(attachment.originalName)}"`,
      // Private (per-session-cookie-gated), long-lived: the file content
      // never changes once uploaded, so the browser can cache it.
      'Cache-Control': 'private, max-age=86400, immutable',
    },
  });
}
