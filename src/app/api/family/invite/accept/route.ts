import 'server-only';
import { NextResponse, type NextRequest } from 'next/server';
import { requireUserId, unauthorizedResponse } from '@/lib/api-auth';
import { inviteAcceptSchema } from '@/lib/validation';
import { acceptFamilyInvite } from '@/lib/family';

export async function POST(req: NextRequest) {
  const userId = await requireUserId();
  if (!userId) return unauthorizedResponse();

  const body = await req.json().catch(() => null);
  const parsed = inviteAcceptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await acceptFamilyInvite(userId, parsed.data.code);
  if (!result.ok) {
    const message =
      result.reason === 'already_in_a_family'
        ? 'This account already belongs to a family and cannot join another.'
        : 'This invite link is invalid or has expired.';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, familyId: result.familyId });
}
