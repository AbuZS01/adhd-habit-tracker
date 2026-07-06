import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.CRON_SECRET = 'test-cron-secret-value-1234567890';
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
process.env.AUTH_SECRET = 'test-auth-secret-1234567890123456';
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const { sanitizeNotificationText } = await import('../lib/push');

// SR-11: titles/bodies sent to web-push must be plain text, length-capped,
// and stripped of control characters before send.

test('sanitizeNotificationText strips control characters', () => {
  const result = sanitizeNotificationText('Hello\x00\x01World\x1F!', 60);
  assert.equal(result, 'HelloWorld!');
});

test('sanitizeNotificationText caps length', () => {
  const long = 'a'.repeat(500);
  const result = sanitizeNotificationText(long, 60);
  assert.equal(result.length, 60);
});

test('sanitizeNotificationText does not interpret HTML — passes through as literal text', () => {
  const payload = '<img src=x onerror=alert(1)>';
  const result = sanitizeNotificationText(payload, 160);
  // The function only strips control chars + trims/caps; it does not need
  // to escape HTML because the service worker's showNotification() always
  // renders body/title as plain text, never innerHTML (verified in
  // public/sw.js — no innerHTML/eval/Function use).
  assert.equal(result, payload);
});

test('sanitizeNotificationText trims surrounding whitespace after stripping', () => {
  const result = sanitizeNotificationText('  \x00 hello \x01  ', 60);
  assert.equal(result, 'hello');
});
