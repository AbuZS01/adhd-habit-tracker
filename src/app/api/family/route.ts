import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse } from '@/lib/api-auth';
import { updateFamilySchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { families, familyMembers, users } from '@/db/schema';

export async function GET() {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const db = getDb();
  const [family] = await db.select().from(families).where(eq(families.id, session.familyId));
  const members = await db
    .select({
      userId: familyMembers.userId,
      role: familyMembers.role,
      joinedAt: familyMembers.joinedAt,
      name: users.name,
      email: users.email,
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, session.familyId));

  return NextResponse.json({ family, members, currentRole: session.role });
}

export async function PATCH(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Only the family owner can rename the family' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateFamilySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(families)
    .set({ name: parsed.data.name })
    .where(eq(families.id, session.familyId))
    .returning();

  return NextResponse.json({ family: updated });
}
