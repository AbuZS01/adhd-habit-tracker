import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { requireFamily, unauthorizedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { ATTACHMENT_ALLOWED_CONTENT_TYPES, ATTACHMENT_MAX_BYTES, idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, logEntries } from '@/db/schema';

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
 * Token-issuance endpoint for client-side Vercel Blob uploads
 * (`@vercel/blob/client`'s `upload()` calls this automatically). This is
 * the actual enforcement point for who may upload what — the DB row
 * created afterward by `POST /api/entries/[id]/attachments` only records
 * an upload that has already happened, it does not gate it.
 */
export async function POST(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const rl = checkRateLimit(
    `user:${session.userId}:attachments:upload-token`,
    RATE_LIMITS.attachmentsWrite.limit,
    RATE_LIMITS.attachmentsWrite.windowMs
  );
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = (await req.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let logEntryId: string | undefined;
        try {
          logEntryId = clientPayload ? (JSON.parse(clientPayload) as { logEntryId?: string }).logEntryId : undefined;
        } catch {
          logEntryId = undefined;
        }
        if (!logEntryId || !idParamSchema.safeParse(logEntryId).success) {
          throw new Error('Invalid or missing logEntryId');
        }

        const entry = await loadOwnedEntry(session.familyId, logEntryId);
        if (!entry) {
          throw new Error('Log entry not found');
        }

        // Defense in depth: the pathname must be scoped to this entry, even
        // though it's our own client code choosing it, not attacker input.
        if (!pathname.startsWith(`entries/${logEntryId}/`)) {
          throw new Error('Invalid pathname');
        }

        return {
          allowedContentTypes: [...ATTACHMENT_ALLOWED_CONTENT_TYPES],
          maximumSizeInBytes: ATTACHMENT_MAX_BYTES,
          addRandomSuffix: true,
          tokenPayload: JSON.stringify({ logEntryId, userId: session.userId }),
        };
      },
      // No onUploadCompleted: that webhook requires a publicly reachable
      // callback URL Vercel Blob can reach back on, which isn't reliable in
      // local dev or every preview environment. The DB row is instead
      // created by an explicit, authenticated follow-up call from the
      // browser once `upload()` resolves (POST /api/entries/[id]/attachments).
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Upload authorization failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
