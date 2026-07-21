import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { families, familyMembers, users } from '@/db/schema';
import FamilyManager from '@/components/FamilyManager';

export default async function FamilyPage() {
  const session = await requireSessionFamily();
  if (!session) redirect('/');

  const db = getDb();
  const [family] = await db.select().from(families).where(eq(families.id, session.familyId));
  const members = await db
    .select({
      userId: familyMembers.userId,
      role: familyMembers.role,
      name: users.name,
      email: users.email,
    })
    .from(familyMembers)
    .innerJoin(users, eq(users.id, familyMembers.userId))
    .where(eq(familyMembers.familyId, session.familyId));

  return (
    <main className="container">
      <h1>Family</h1>
      <FamilyManager
        familyName={family?.name ?? ''}
        nation={family?.nation ?? null}
        isOwner={session.role === 'owner'}
        members={members}
      />
    </main>
  );
}
