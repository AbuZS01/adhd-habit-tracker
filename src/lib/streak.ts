import 'server-only';

/**
 * Forgiving streak calculation ("days shown up", not a punitive
 * reset-on-miss counter). All math runs server-side over stored check-in
 * timestamps — the client never supplies or trusts a streak number.
 *
 * Rules (per PLAN.md section 5 "engagement mechanics"):
 * - A "day" is counted once regardless of how many check-ins happened.
 * - The current streak tolerates up to `graceDays` missed calendar days in
 *   a row before it resets; it does not zero out on a single miss.
 * - Streak is computed in the user's IANA timezone so day boundaries match
 *   their actual day, not UTC.
 */

const DEFAULT_GRACE_DAYS = 1;

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
  totalCheckins: number;
  lastCheckinDate: string | null; // YYYY-MM-DD in user's timezone
}

function toLocalDateKey(date: Date, timeZone: string): string {
  // en-CA gives YYYY-MM-DD ordering, stable for string comparison/sorting.
  return new Intl.DateTimeFormat('en-CA', { timeZone }).format(date);
}

/** Parses a "YYYY-MM-DD" key into an integer day index (days since epoch). */
function dateKeyToDayNumber(key: string): number {
  const parts = key.split('-').map(Number);
  const year = parts[0] ?? 1970;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

export function computeStreak(
  checkinTimestamps: Date[],
  timeZone: string,
  graceDays: number = DEFAULT_GRACE_DAYS
): StreakResult {
  if (checkinTimestamps.length === 0) {
    return { currentStreak: 0, longestStreak: 0, totalCheckins: 0, lastCheckinDate: null };
  }

  // De-duplicate to one entry per local calendar day, sorted ascending.
  const uniqueDayKeys = Array.from(
    new Set(checkinTimestamps.map((d) => toLocalDateKey(d, timeZone)))
  ).sort();

  const dayNumbers = uniqueDayKeys.map(dateKeyToDayNumber);

  let longestStreak = 1;
  let runLength = 1;
  for (let i = 1; i < dayNumbers.length; i++) {
    const gap = dayNumbers[i]! - dayNumbers[i - 1]!;
    if (gap - 1 <= graceDays) {
      // gap of 1 = consecutive day; gap-1 missed days tolerated by grace.
      runLength += 1;
    } else {
      runLength = 1;
    }
    if (runLength > longestStreak) longestStreak = runLength;
  }

  // Current streak: walk backwards from today, same tolerance.
  const todayKey = toLocalDateKey(new Date(), timeZone);
  const todayNum = dateKeyToDayNumber(todayKey);

  let currentStreak = 0;
  const lastDayNum = dayNumbers[dayNumbers.length - 1]!;
  const daysSinceLast = todayNum - lastDayNum;

  if (daysSinceLast - 1 <= graceDays) {
    // Streak still "alive" (within grace window of today).
    currentStreak = 1;
    for (let i = dayNumbers.length - 1; i > 0; i--) {
      const gap = dayNumbers[i]! - dayNumbers[i - 1]!;
      if (gap - 1 <= graceDays) {
        currentStreak += 1;
      } else {
        break;
      }
    }
  }

  return {
    currentStreak,
    longestStreak,
    totalCheckins: checkinTimestamps.length,
    lastCheckinDate: uniqueDayKeys[uniqueDayKeys.length - 1] ?? null,
  };
}
