import 'server-only';
import webpush from 'web-push';
import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { pushSubscriptions } from '@/db/schema';
import { getServerEnv } from '@/lib/env';
import { stripControlChars } from '@/lib/validation';

// Allowlist of internal routes the service worker is permitted to deep-link
// to on notificationclick (SR-11) — never an arbitrary/external URL.
const DEEPLINK_ALLOWLIST_PREFIXES = ['/', '/habits', '/settings'];

export interface NotificationPayload {
  title: string;
  body: string;
  /** Internal path only; validated against an allowlist before send. */
  url: string;
  habitId?: string;
}

const MAX_TITLE_LEN = 60;
const MAX_BODY_LEN = 160;

/**
 * Sanitises a notification title/body to plain text: strips control
 * characters and caps length (SR-11). Must be called on every string
 * before it is handed to web-push, regardless of source.
 */
export function sanitizeNotificationText(input: string, maxLen: number): string {
  const stripped = stripControlChars(input).trim();
  return stripped.length > maxLen ? stripped.slice(0, maxLen) : stripped;
}

function sanitizeDeepLink(url: string): string {
  // Only allow a same-origin relative path starting with an allowlisted
  // prefix. Anything else (absolute URL, protocol-relative, javascript:,
  // etc.) falls back to the safe default "/".
  if (!url.startsWith('/') || url.startsWith('//')) return '/';
  const isAllowed = DEEPLINK_ALLOWLIST_PREFIXES.some((prefix) => url === prefix || url.startsWith(`${prefix}/`) || url.startsWith(`${prefix}?`));
  return isAllowed ? url : '/';
}

let vapidConfigured = false;
function ensureVapidConfigured() {
  if (vapidConfigured) return;
  const env = getServerEnv();
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  vapidConfigured = true;
}

export interface SendResult {
  ok: boolean;
  statusCode?: number;
  deadSubscription: boolean;
}

/**
 * Sends one push notification and returns whether the subscription is dead
 * (404/410), so the caller can delete it (SR-8). Never throws for expected
 * push-service error responses.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  payload: NotificationPayload
): Promise<SendResult> {
  ensureVapidConfigured();

  const safePayload = {
    title: sanitizeNotificationText(payload.title, MAX_TITLE_LEN),
    body: sanitizeNotificationText(payload.body, MAX_BODY_LEN),
    url: sanitizeDeepLink(payload.url),
  };

  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(safePayload)
    );
    return { ok: true, deadSubscription: false };
  } catch (err: unknown) {
    const statusCode = (err as { statusCode?: number } | undefined)?.statusCode;
    const isDead = statusCode === 404 || statusCode === 410;
    return { ok: false, statusCode, deadSubscription: isDead };
  }
}

/**
 * Deletes a dead subscription row immediately (SR-8) so future dispatch
 * cycles never retry it.
 */
export async function deleteSubscriptionByEndpoint(endpoint: string): Promise<void> {
  const db = getDb();
  await db.delete(pushSubscriptions).where(eq(pushSubscriptions.endpoint, endpoint));
}
