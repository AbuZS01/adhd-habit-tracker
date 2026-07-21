import 'server-only';
import { NextResponse } from 'next/server';
import { requireFamily, unauthorizedResponse, rateLimitedResponse } from '@/lib/api-auth';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { createFamilyInvite } from '@/lib/family';

export async function POST() {
  const session = await requireFamily();
  if (!session) return unauthorizedResponse();
  if (session.role !== 'owner') {
    return NextResponse.json({ error: 'Only the family owner can invite guardians' }, { status: 403 });
  }

  const rl = checkRateLimit(`user:${session.userId}:invite:POST`, RATE_LIMITS.inviteCreate.limit, RATE_LIMITS.inviteCreate.windowMs);
  if (!rl.allowed) return rateLimitedResponse(rl.retryAfterSeconds);

  const invite = await createFamilyInvite(session);

  return NextResponse.json({ code: invite.code, expiresAt: invite.expiresAt }, { status: 201 });
}
