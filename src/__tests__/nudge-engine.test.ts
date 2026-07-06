import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isWithinQuietHours, getLocalHour } from '../lib/nudge-engine';

test('isWithinQuietHours: simple same-day window (e.g. 1am-6am)', () => {
  assert.equal(isWithinQuietHours(3, 1, 6), true);
  assert.equal(isWithinQuietHours(0, 1, 6), false);
  assert.equal(isWithinQuietHours(7, 1, 6), false);
});

test('isWithinQuietHours: wraps midnight (e.g. 22-8)', () => {
  assert.equal(isWithinQuietHours(23, 22, 8), true);
  assert.equal(isWithinQuietHours(2, 22, 8), true);
  assert.equal(isWithinQuietHours(8, 22, 8), false, 'end hour is exclusive');
  assert.equal(isWithinQuietHours(12, 22, 8), false);
});

test('isWithinQuietHours: equal start/end means no quiet window configured', () => {
  assert.equal(isWithinQuietHours(10, 5, 5), false);
});

test('getLocalHour resolves a known UTC instant correctly in a fixed-offset zone', () => {
  const date = new Date('2026-01-15T12:00:00.000Z');
  // Fixed offset zone with no DST ambiguity.
  const hour = getLocalHour(date, 'Etc/GMT-5'); // UTC+5
  assert.equal(hour, 17);
});
