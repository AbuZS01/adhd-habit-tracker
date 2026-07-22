import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeRecency } from '@/lib/recency';

test('computeRecency: no entries yet', () => {
  const r = computeRecency(null);
  assert.equal(r.tier, 'none');
  assert.equal(r.ringPercent, 0);
});

test('computeRecency: logged today', () => {
  const today = new Date('2026-07-22T12:00:00Z');
  const r = computeRecency('2026-07-22', today);
  assert.equal(r.tier, 'good');
  assert.equal(r.ringPercent, 100);
  assert.equal(r.label, 'Logged today');
});

test('computeRecency: within a week is "good"', () => {
  const today = new Date('2026-07-22T12:00:00Z');
  const r = computeRecency('2026-07-16', today); // 6 days ago
  assert.equal(r.tier, 'good');
  assert.match(r.label, /6 days ago/);
});

test('computeRecency: within a month is "warn"', () => {
  const today = new Date('2026-07-22T12:00:00Z');
  const r = computeRecency('2026-07-01', today); // 21 days ago -> 3 weeks
  assert.equal(r.tier, 'warn');
  assert.equal(r.ringPercent, 50);
  assert.match(r.label, /3 weeks ago/);
});

test('computeRecency: over a month is "stale"', () => {
  const today = new Date('2026-07-22T12:00:00Z');
  const r = computeRecency('2026-05-01', today);
  assert.equal(r.tier, 'stale');
  assert.equal(r.ringPercent, 15);
});
