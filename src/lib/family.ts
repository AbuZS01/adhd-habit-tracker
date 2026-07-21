import 'server-only';
import { randomBytes } from 'node:crypto';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { getDb } from '@/db/client';
import { families, familyMembers, familyInvites } from '@/db/schema';

export interface SessionFamily {
  userId: string;
  familyId: string;
  role: 'owner' | 'guardian';
}

/**
 * Resolves the signed-in guardian's family + role, auto-provisioning a new
 * family (with this guardian as owner) on first login so there is no
 * separate "create a family" onboarding step. Returns null only when there
 * is no authenticated session.
 *
 * Every child/subject/log-entry query in the app must derive `familyId`
 * from this function's return value, never from a client-supplied field —
 * this is the sole authorization boundary between households.
 */
export async function requireSessionFamily(): Promise<SessionFamily | null> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const existing = await lookupMembership(userId);
  if (existing) return existing;

  const db = getDb();
  const guardianName = session.user?.name?.trim();
  const familyName = guardianName ? `${guardianName}'s family` : 'My family';

  try {
    return await db.transaction(async (tx) => {
      const [family] = await tx.insert(families).values({ name: familyName }).returning();
      if (!family) throw new Error('Failed to create family');
      await tx.insert(familyMembers).values({ familyId: family.id, userId, role: 'owner' });
      return { userId, familyId: family.id, role: 'owner' as const };
    });
  } catch {
    // Concurrent first-login race: another in-flight request already
    // created the membership row (unique on user_id). Re-read it.
    const retried = await lookupMembership(userId);
    if (retried) return retried;
    throw new Error('Failed to provision a family for this account');
  }
}

async function lookupMembership(userId: string): Promise<SessionFamily | null> {
  const db = getDb();
  const [row] = await db
    .select({ familyId: familyMembers.familyId, role: familyMembers.role })
    .from(familyMembers)
    .where(eq(familyMembers.userId, userId));
  return row ? { userId, familyId: row.familyId, role: row.role } : null;
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Creates a single-use, expiring invite code for the owner's family. Only
 * the family owner may generate invites (guardians who joined via invite
 * cannot mint further invites, keeping membership growth auditable).
 */
export async function createFamilyInvite(session: SessionFamily) {
  if (session.role !== 'owner') {
    throw new Error('Only the family owner can invite guardians');
  }
  const db = getDb();
  const code = randomBytes(24).toString('base64url');
  const [invite] = await db
    .insert(familyInvites)
    .values({
      familyId: session.familyId,
      code,
      createdByUserId: session.userId,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    })
    .returning();
  if (!invite) throw new Error('Failed to create invite');
  return invite;
}

export interface InviteLookupResult {
  familyId: string;
  familyName: string;
}

/**
 * Validates an invite code (exists, unused, unexpired) without consuming
 * it — used to render the "Join <family>" confirmation page.
 */
export async function lookupValidInvite(code: string): Promise<InviteLookupResult | null> {
  const db = getDb();
  const [row] = await db
    .select({ familyId: familyInvites.familyId, familyName: families.name })
    .from(familyInvites)
    .innerJoin(families, eq(families.id, familyInvites.familyId))
    .where(and(eq(familyInvites.code, code), isNull(familyInvites.usedAt), gt(familyInvites.expiresAt, new Date())));
  return row ?? null;
}

export type AcceptInviteResult =
  | { ok: true; familyId: string }
  | { ok: false; reason: 'invalid_or_expired' | 'already_in_a_family' };

/**
 * Consumes an invite code, adding the current user as a 'guardian' member
 * of the invite's family. Fails closed if the user is already a member of
 * any family (this MVP does not support moving between families) or if
 * the invite is missing/expired/already used.
 */
export async function acceptFamilyInvite(userId: string, code: string): Promise<AcceptInviteResult> {
  const existing = await lookupMembership(userId);
  if (existing) {
    return { ok: false, reason: 'already_in_a_family' };
  }

  const db = getDb();
  return db.transaction(async (tx) => {
    const [invite] = await tx
      .select()
      .from(familyInvites)
      .where(and(eq(familyInvites.code, code), isNull(familyInvites.usedAt), gt(familyInvites.expiresAt, new Date())));

    if (!invite) {
      return { ok: false, reason: 'invalid_or_expired' as const };
    }

    await tx
      .update(familyInvites)
      .set({ usedAt: new Date(), usedByUserId: userId })
      .where(eq(familyInvites.id, invite.id));

    await tx.insert(familyMembers).values({ familyId: invite.familyId, userId, role: 'guardian' });

    return { ok: true as const, familyId: invite.familyId };
  });
}
