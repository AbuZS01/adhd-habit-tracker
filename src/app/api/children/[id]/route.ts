import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { updateChildSchema, idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children } from '@/db/schema';

async function loadOwnedChild(familyId: string, childId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)));
  return row ?? null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedChild(session.familyId, id);
  if (!existing) return notFoundResponse();

  return NextResponse.json({ child: { id: existing.id, name: existing.name } });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const rl = checkRateLimit(`user:${session.userId}:children:PATCH`, RATE_LIMITS.childrenWrite.limit, RATE_LIMITS.childrenWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  // Ownership check before any write: a child id from another family must
  // never be readable or writable via this route.
  const existing = await loadOwnedChild(session.familyId, id);
  if (!existing) return notFoundResponse();

  const body = await req.json().catch(() => null);
  const parsed = updateChildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(children)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(and(eq(children.id, id), eq(children.familyId, session.familyId)))
    .returning();

  return NextResponse.json({ child: updated });
}

// Archives rather than hard-deletes: this app's whole purpose is retaining
// evidence, so a child profile (and its subjects/log entries) is never
// destroyed by a click — it is hidden from the active list and can be
// restored via PATCH { isArchived: false }.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const { id } = await params;
  if (!idParamSchema.safeParse(id).success) return notFoundResponse();

  const existing = await loadOwnedChild(session.familyId, id);
  if (!existing) return notFoundResponse();

  const db = getDb();
  const [updated] = await db
    .update(children)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(and(eq(children.id, id), eq(children.familyId, session.familyId)))
    .returning();

  return NextResponse.json({ child: updated });
}
