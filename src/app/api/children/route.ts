import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { eq, and } from 'drizzle-orm';
import { requireFamily, unauthorizedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createChildSchema } from '@/lib/validation';
import { getDb } from '@/db/client';
import { children, subjects } from '@/db/schema';

// Seeded when a child profile is created — a starting point, not a fixed
// curriculum. Guardians can rename, add, and archive freely afterward.
const DEFAULT_SUBJECTS = ['English', 'Maths', 'Science', 'Wider Learning'];

export async function GET() {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const db = getDb();
  const rows = await db
    .select()
    .from(children)
    .where(and(eq(children.familyId, session.familyId), eq(children.isArchived, false)))
    .orderBy(children.createdAt);

  return NextResponse.json({ children: rows });
}

export async function POST(req: NextRequest) {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();

  const rl = checkRateLimit(`user:${session.userId}:children:POST`, RATE_LIMITS.childrenWrite.limit, RATE_LIMITS.childrenWrite.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const body = await req.json().catch(() => null);
  const parsed = createChildSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const db = getDb();
  const child = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(children)
      .values({
        familyId: session.familyId,
        name: parsed.data.name,
        dateOfBirth: parsed.data.dateOfBirth ?? null,
        yearGroup: parsed.data.yearGroup ?? null,
        notes: parsed.data.notes ?? null,
      })
      .returning();

    if (!row) throw new Error('Failed to create child');

    await tx.insert(subjects).values(
      DEFAULT_SUBJECTS.map((name, index) => ({
        childId: row.id,
        name,
        sortOrder: index,
      }))
    );

    return row;
  });

  return NextResponse.json({ child }, { status: 201 });
}
