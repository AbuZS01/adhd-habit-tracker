import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeStreak } from '../lib/streak';

const TZ = 'UTC';

function daysAgo(n: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(12, 0, 0, 0);
  return d;
}

test('computeStreak returns zeros for no check-ins', () => {
  const result = computeStreak([], TZ);
  assert.equal(result.currentStreak, 0);
  assert.equal(result.longestStreak, 0);
  assert.equal(result.totalCheckins, 0);
});

test('computeStreak counts consecutive days including today', () => {
  const checkins = [daysAgo(0), daysAgo(1), daysAgo(2)];
  const result = computeStreak(checkins, TZ, 0);
  assert.equal(result.currentStreak, 3);
  assert.equal(result.longestStreak, 3);
});

test('computeStreak does not zero out on a single missed day (forgiving, grace=1)', () => {
  // Checked in today and 2 days ago, missed yesterday.
  const checkins = [daysAgo(0), daysAgo(2)];
  const result = computeStreak(checkins, TZ, 1);
  assert.equal(result.currentStreak, 2, 'a single missed day should not reset the streak with grace=1');
});

test('computeStreak resets when the gap exceeds the grace window', () => {
  const checkins = [daysAgo(0), daysAgo(5)];
  const result = computeStreak(checkins, TZ, 1);
  assert.equal(result.currentStreak, 1, 'a 4-day gap should not be tolerated by grace=1');
});

test('computeStreak de-duplicates multiple check-ins on the same day', () => {
  const today = daysAgo(0);
  const alsoToday = new Date(today.getTime() + 60_000);
  const result = computeStreak([today, alsoToday], TZ, 0);
  assert.equal(result.currentStreak, 1);
  assert.equal(result.totalCheckins, 2);
});
