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
    return NextResponse.json({ error: 'Only the family owner can change family settings' }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateFamilySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  // Build the update explicitly from only the fields actually sent, rather
  // than passing the parsed object straight through — a key present with
  // value `undefined` (i.e. simply not sent) must not be conflated with an
  // explicit `null` (nation is nullable — clearing it is a valid request).
  const updateData: Partial<{ name: string; nation: 'england' | 'wales' | 'scotland' | 'northern_ireland' | null }> = {};
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.nation !== undefined) updateData.nation = parsed.data.nation;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No changes provided' }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(families)
    .set(updateData)
    .where(eq(families.id, session.familyId))
    .returning();

  return NextResponse.json({ family: updated });
}
