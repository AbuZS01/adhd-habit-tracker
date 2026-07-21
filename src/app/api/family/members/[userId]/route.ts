import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, notFoundResponse } from '@/lib/api-auth';
import { idParamSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { familyMembers } from '@/db/schema';

// Removes a guardian from the family. Owner-only, and the owner role
// itself can never be removed through this route (a family always keeps
// exactly the guardian who created it, avoiding an orphaned family).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Only the family owner can remove guardians' }, { status: 403 });
  }

  const { userId: targetUserId } = await params;
  if (!idParamSchema.safeParse(targetUserId).success) return notFoundResponse();

  const db = getDb();
  const [target] = await db
    .select()
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, targetUserId), eq(familyMembers.familyId, session.familyId)));

  if (!target) return notFoundResponse();
  if (target.role === 'owner') {
    return NextResponse.json({ error: 'The family owner cannot be removed' }, { status: 400 });
  }

  await db.delete(familyMembers).where(eq(familyMembers.id, target.id));

  return NextResponse.json({ ok: true });
}
