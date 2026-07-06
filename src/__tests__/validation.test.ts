import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createHabitSchema,
  updateHabitSchema,
  habitIdParamSchema,
  createCheckinSchema,
  pushSubscriptionSchema,
  timezoneSchema,
  stripControlChars,
} from '../lib/validation';

// SR-6: fuzzed/oversized/malformed inputs must be rejected, never partially
// written. SR-11 groundwork: control chars must be stripped before any
// string reaches a notification payload.

test('stripControlChars removes ASCII control characters but keeps normal text', () => {
  const input = 'Take meds\x00\x01\x1F\x7F today';
  assert.equal(stripControlChars(input), 'Take meds today');
});

test('createHabitSchema rejects an empty name', () => {
  const result = createHabitSchema.safeParse({ name: '', scheduleTime: '09:00', activeDays: [1] });
  assert.equal(result.success, false);
});

test('createHabitSchema rejects an oversized name (>80 chars)', () => {
  const longName = 'a'.repeat(500);
  const result = createHabitSchema.safeParse({ name: longName, scheduleTime: '09:00', activeDays: [1] });
  assert.equal(result.success, false);
});

test('createHabitSchema strips control characters from name before length check', () => {
  const result = createHabitSchema.safeParse({
    name: 'Take meds\x00\x01',
    scheduleTime: '09:00',
    activeDays: [1],
  });
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.name, 'Take meds');
  }
});

test('createHabitSchema rejects an invalid schedule time', () => {
  const result = createHabitSchema.safeParse({ name: 'Test', scheduleTime: '25:99', activeDays: [1] });
  assert.equal(result.success, false);
});

test('createHabitSchema rejects out-of-range activeDays', () => {
  const result = createHabitSchema.safeParse({ name: 'Test', scheduleTime: '09:00', activeDays: [7, -1] });
  assert.equal(result.success, false);
});

test('createHabitSchema does not reflect XSS payload as HTML — stored as plain text', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const result = createHabitSchema.safeParse({ name: payload, scheduleTime: '09:00', activeDays: [1] });
  assert.equal(result.success, true);
  if (result.success) {
    // The raw string is preserved (React will escape it on render; this
    // schema's job is only length/control-char hygiene, not HTML removal).
    assert.equal(result.data.name, payload);
  }
});

test('updateHabitSchema accepts a partial update with only isArchived', () => {
  const result = updateHabitSchema.safeParse({ isArchived: true });
  assert.equal(result.success, true);
});

test('habitIdParamSchema rejects a non-UUID id (path traversal / injection attempt)', () => {
  const attempts = ['../../etc/passwd', '1 OR 1=1', '<script>', '', '00000000-0000-0000-0000-00000000000'];
  for (const attempt of attempts) {
    const result = habitIdParamSchema.safeParse(attempt);
    assert.equal(result.success, false, `expected rejection for: ${attempt}`);
  }
});

test('habitIdParamSchema accepts a well-formed UUID', () => {
  const result = habitIdParamSchema.safeParse('123e4567-e89b-12d3-a456-426614174000');
  assert.equal(result.success, true);
});

test('createCheckinSchema rejects a non-UUID habitId', () => {
  const result = createCheckinSchema.safeParse({ habitId: 'not-a-uuid' });
  assert.equal(result.success, false);
});

test('pushSubscriptionSchema rejects a non-URL endpoint', () => {
  const result = pushSubscriptionSchema.safeParse({
    endpoint: 'javascript:alert(1)',
    keys: { p256dh: 'x', auth: 'y' },
  });
  assert.equal(result.success, false);
});

test('pushSubscriptionSchema accepts a well-formed subscription', () => {
  const result = pushSubscriptionSchema.safeParse({
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc123',
    keys: { p256dh: 'a'.repeat(64), auth: 'b'.repeat(16) },
  });
  assert.equal(result.success, true);
});

test('timezoneSchema rejects a garbage timezone string', () => {
  const result = timezoneSchema.safeParse('Not/A_Real_Zone_ZZZ');
  assert.equal(result.success, false);
});

test('timezoneSchema accepts a valid IANA timezone', () => {
  const result = timezoneSchema.safeParse('America/New_York');
  assert.equal(result.success, true);
});
