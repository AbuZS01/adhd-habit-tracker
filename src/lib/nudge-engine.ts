import 'server-only';
import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { habits, notificationLog, pushSubscriptions, users, checkins } from '@/db/schema';
import { sanitizeNotificationText } from '@/lib/push';
import type { NotificationPayload } from '@/lib/push';

/**
 * Anti-habituation nudge engine (PLAN.md section 5 "the core").
 *
 * Responsibilities:
 * - Respect quiet hours + timezone.
 * - Timing jitter so nudges never fire at the exact same clock minute.
 * - Rotating message variants so wording never repeats verbatim back to back.
 * - Escalation: one unacknowledged nudge triggers a second, differently
 *   worded nudge later the same day, then backs off until tomorrow.
 * - Dedupe via notification_log so the same nudge slot never double-fires.
 */

// ---- Message variants -----------------------------------------------------
// Each variant is a template function; {cue} and {name} are interpolated
// and then passed through sanitizeNotificationText (SR-11) before send.

type Variant = { key: string; title: (name: string) => string; body: (name: string, cue?: string) => string };

const INITIAL_VARIANTS: Variant[] = [
  {
    key: 'implementation-intention',
    title: () => 'Cue check-in',
    body: (name, cue) => (cue ? `${cue}, then: ${name}.` : `Ready for: ${name}?`),
  },
  {
    key: 'encouragement',
    title: () => "You've got this",
    body: (name) => `One tap for ${name} — small counts.`,
  },
  {
    key: 'curiosity',
    title: () => 'Quick one',
    body: (name) => `${name} — done yet, or now's a good time?`,
  },
];

const ESCALATION_VARIANTS: Variant[] = [
  {
    key: 'gentle-followup',
    title: () => 'Still open',
    body: (name) => `No rush — ${name} is still there whenever.`,
  },
  {
    key: 'reframe',
    title: () => 'Different angle',
    body: (name, cue) => (cue ? `After ${cue.replace(/^after\s+/i, '')}? ${name}.` : `A minute for ${name}?`),
  },
];

function pickVariant(variants: Variant[], seed: number): Variant {
  const idx = seed % variants.length;
  return variants[idx] ?? variants[0]!;
}

// ---- Quiet hours -----------------------------------------------------------

export function isWithinQuietHours(localHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart === quietEnd) return false; // no quiet window configured
  if (quietStart < quietEnd) {
    return localHour >= quietStart && localHour < quietEnd;
  }
  // Wraps midnight, e.g. 22 -> 8.
  return localHour >= quietStart || localHour < quietEnd;
}

export function getLocalHour(date: Date, timeZone: string): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  // en-US 24h formatting can yield "24" for midnight in some ICU versions.
  const hour = Number(formatted) % 24;
  return hour;
}

function getLocalDayOfWeek(date: Date, timeZone: string): number {
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[weekday] ?? date.getUTCDay();
}

function getLocalDateKey(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

// ---- Jitter ----------------------------------------------------------------

/**
 * Deterministic-but-varying jitter in minutes, seeded from habit id + date
 * so the same habit doesn't jitter identically every day, but a single
 * dispatch run is idempotent (re-running the same minute doesn't reroll).
 */
function jitterMinutes(seedString: string, maxJitter = 12): number {
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash * 31 + seedString.charCodeAt(i)) | 0;
  }
  const normalized = Math.abs(hash) % (maxJitter * 2 + 1);
  return normalized - maxJitter; // range [-maxJitter, +maxJitter]
}

// ---- Due-habit selection ----------------------------------------------------

export interface DueNudge {
  habitId: string;
  userId: string;
  kind: 'initial' | 'escalation';
  payload: NotificationPayload;
  variantKey: string;
}

const ESCALATION_DELAY_MINUTES = 90;
const DISPATCH_WINDOW_MINUTES = 15; // matches Vercel Cron cadence

/**
 * Computes which habits are due for a nudge right now, applying quiet
 * hours, timezone, jitter, escalation, and dedupe (via notification_log).
 * Pure selection logic — sending is done by the caller (cron route) so
 * this function stays testable without network calls.
 */
export async function selectDueNudges(now: Date = new Date()): Promise<DueNudge[]> {
  const db = getDb();
  const due: DueNudge[] = [];

  const activeHabits = await db
    .select({
      habitId: habits.id,
      userId: habits.userId,
      name: habits.name,
      cue: habits.cue,
      scheduleTime: habits.scheduleTime,
      activeDays: habits.activeDays,
      timezone: users.timezone,
      quietHoursStart: users.quietHoursStart,
      quietHoursEnd: users.quietHoursEnd,
    })
    .from(habits)
    .innerJoin(users, eq(habits.userId, users.id))
    .where(eq(habits.isArchived, false));

  for (const h of activeHabits) {
    const timeZone = h.timezone || 'UTC';
    const localHour = getLocalHour(now, timeZone);
    const dayOfWeek = getLocalDayOfWeek(now, timeZone);
    const dateKey = getLocalDateKey(now, timeZone);

    if (!h.activeDays.includes(dayOfWeek)) continue;
    if (isWithinQuietHours(localHour, h.quietHoursStart, h.quietHoursEnd)) continue;

    // Has the user already checked in today for this habit? If so, no nudge.
    const todayStart = new Date(`${dateKey}T00:00:00.000Z`);
    const checkinsToday = await db
      .select({ id: checkins.id })
      .from(checkins)
      .where(and(eq(checkins.habitId, h.habitId), gte(checkins.checkedAt, todayStart)));
    if (checkinsToday.length > 0) continue;

    // Parse scheduled local time and apply jitter.
    const [schedHourStr, schedMinStr] = h.scheduleTime.split(':');
    const schedHour = Number(schedHourStr);
    const schedMin = Number(schedMinStr);
    const jitter = jitterMinutes(`${h.habitId}:${dateKey}`);
    const scheduledMinutesOfDay = schedHour * 60 + schedMin + jitter;
    const nowMinutesOfDay = localHour * 60 + Number(new Intl.DateTimeFormat('en-US', { timeZone, minute: 'numeric' }).format(now));

    const withinInitialWindow = Math.abs(nowMinutesOfDay - scheduledMinutesOfDay) <= DISPATCH_WINDOW_MINUTES / 2;

    // Dedupe: has an 'initial' nudge already been logged today for this habit?
    const priorLogs = await db
      .select({ kind: notificationLog.kind, sentAt: notificationLog.sentAt, status: notificationLog.status })
      .from(notificationLog)
      .where(and(eq(notificationLog.habitId, h.habitId), gte(notificationLog.sentAt, todayStart)));

    const hasInitialToday = priorLogs.some((l) => l.kind === 'initial' && l.status === 'sent');
    const hasEscalationToday = priorLogs.some((l) => l.kind === 'escalation' && l.status === 'sent');

    if (!hasInitialToday && withinInitialWindow) {
      const variant = pickVariant(INITIAL_VARIANTS, jitter + schedHour);
      due.push({
        habitId: h.habitId,
        userId: h.userId,
        kind: 'initial',
        variantKey: variant.key,
        payload: {
          title: sanitizeNotificationText(variant.title(h.name), 60),
          body: sanitizeNotificationText(variant.body(h.name, h.cue ?? undefined), 160),
          url: '/',
          habitId: h.habitId,
        },
      });
      continue;
    }

    // Escalation: only if an initial nudge already went out today, none has
    // escalated yet, still no check-in, and enough time has passed.
    if (hasInitialToday && !hasEscalationToday) {
      const lastInitial = priorLogs
        .filter((l) => l.kind === 'initial' && l.status === 'sent')
        .sort((a, b) => b.sentAt.getTime() - a.sentAt.getTime())[0];
      if (!lastInitial) continue;

      const minutesSinceInitial = (now.getTime() - lastInitial.sentAt.getTime()) / 60_000;
      const withinEscalationWindow =
        minutesSinceInitial >= ESCALATION_DELAY_MINUTES &&
        minutesSinceInitial <= ESCALATION_DELAY_MINUTES + DISPATCH_WINDOW_MINUTES;

      if (withinEscalationWindow) {
        const variant = pickVariant(ESCALATION_VARIANTS, jitter + schedMin);
        due.push({
          habitId: h.habitId,
          userId: h.userId,
          kind: 'escalation',
          variantKey: variant.key,
          payload: {
            title: sanitizeNotificationText(variant.title(h.name), 60),
            body: sanitizeNotificationText(variant.body(h.name, h.cue ?? undefined), 160),
            url: '/',
            habitId: h.habitId,
          },
        });
      }
      // After this window passes with no check-in, the engine backs off
      // for the day (no further nudges) — enforced simply by there being
      // no further branches: hasInitialToday && hasEscalationToday falls
      // through with nothing added.
    }
  }

  return due;
}

/** Records a dispatch attempt outcome for dedupe/backoff (part of SR-8 flow). */
export async function logNotificationAttempt(params: {
  userId: string;
  habitId: string;
  kind: 'initial' | 'escalation';
  variantKey: string;
  status: 'sent' | 'failed' | 'skipped_quiet_hours' | 'dead_subscription';
}): Promise<void> {
  const db = getDb();
  await db.insert(notificationLog).values({
    userId: params.userId,
    habitId: params.habitId,
    kind: params.kind,
    variantKey: params.variantKey,
    status: params.status,
  });
}

/** Fetches all live push subscriptions for a user (server-only, SR-3). */
export async function getSubscriptionsForUser(userId: string) {
  const db = getDb();
  return db.select().from(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
}

// Re-export for tests / other modules that need raw table access without
// pulling in drizzle directly.
export const __internals = { sql };
