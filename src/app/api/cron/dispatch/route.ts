import { NextRequest, NextResponse } from 'next/server';
import { selectDueNudges, logNotificationAttempt, getSubscriptionsForUser } from '@/lib/nudge-engine';
import { sendPushNotification, deleteSubscriptionByEndpoint } from '@/lib/push';
import { methodNotAllowedResponse } from '@/lib/api-auth';
import { isAuthorizedCronBearer } from '@/lib/cron-auth';

/**
 * Cron fan-out endpoint (SR-7). Vercel Cron calls this on a fixed cadence
 * carrying `Authorization: Bearer <CRON_SECRET>`. Any request without an
 * exact, constant-time match on that header is rejected with 401 and sends
 * zero notifications — verified before any DB read or push send.
 */

export async function POST(request: NextRequest) {
  if (!isAuthorizedCronBearer(request.headers.get('authorization'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dueNudges = await selectDueNudges();

  let sent = 0;
  let failed = 0;
  let deadRemoved = 0;

  for (const nudge of dueNudges) {
    const subscriptions = await getSubscriptionsForUser(nudge.userId);

    if (subscriptions.length === 0) {
      await logNotificationAttempt({
        userId: nudge.userId,
        habitId: nudge.habitId,
        kind: nudge.kind,
        variantKey: nudge.variantKey,
        status: 'failed',
      });
      failed += 1;
      continue;
    }

    let anySent = false;
    for (const sub of subscriptions) {
      const result = await sendPushNotification(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        nudge.payload
      );

      if (result.ok) {
        anySent = true;
      } else if (result.deadSubscription) {
        // SR-8: delete immediately, never retry a dead endpoint.
        await deleteSubscriptionByEndpoint(sub.endpoint);
        deadRemoved += 1;
      }
    }

    await logNotificationAttempt({
      userId: nudge.userId,
      habitId: nudge.habitId,
      kind: nudge.kind,
      variantKey: nudge.variantKey,
      status: anySent ? 'sent' : 'failed',
    });

    if (anySent) sent += 1;
    else failed += 1;
  }

  return NextResponse.json({ ok: true, sent, failed, deadRemoved, evaluated: dueNudges.length });
}

export async function GET() {
  return methodNotAllowedResponse();
}

export async function PATCH() {
  return methodNotAllowedResponse();
}

export async function DELETE() {
  return methodNotAllowedResponse();
}
