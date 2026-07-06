import { test } from 'node:test';
import assert from 'node:assert/strict';

// SR-7: /api/cron/dispatch must reject any request without a correct
// `Authorization: Bearer <CRON_SECRET>` header, checked in constant time,
// before any DB read or push send happens. Tested against the pure
// `isAuthorizedCronBearer` helper (no `next/server` dependency) so this
// suite runs under the plain Node test runner without a Next.js build.

process.env.CRON_SECRET = 'test-cron-secret-value-1234567890';
process.env.DATABASE_URL = 'postgres://user:pass@localhost:5432/db';
process.env.AUTH_SECRET = 'test-auth-secret-1234567890123456';
process.env.VAPID_PUBLIC_KEY = 'test-vapid-public-key';
process.env.VAPID_PRIVATE_KEY = 'test-vapid-private-key';
process.env.VAPID_SUBJECT = 'mailto:test@example.com';

const { isAuthorizedCronBearer } = await import('../lib/cron-auth');

test('rejects a request with no Authorization header', () => {
  assert.equal(isAuthorizedCronBearer(null), false);
});

test('rejects a request with the wrong bearer token', () => {
  assert.equal(isAuthorizedCronBearer('Bearer wrong-secret-value'), false);
});

test('rejects a request with an empty bearer token', () => {
  assert.equal(isAuthorizedCronBearer('Bearer '), false);
});

test('rejects a request missing the "Bearer " prefix', () => {
  assert.equal(isAuthorizedCronBearer('test-cron-secret-value-1234567890'), false);
});

test('rejects a request with extra characters appended to a valid secret', () => {
  assert.equal(isAuthorizedCronBearer('Bearer test-cron-secret-value-1234567890-extra'), false);
});

test('accepts a request with the exact correct bearer token', () => {
  assert.equal(isAuthorizedCronBearer('Bearer test-cron-secret-value-1234567890'), true);
});

test('rejects case-mismatched scheme', () => {
  assert.equal(isAuthorizedCronBearer('bearer test-cron-secret-value-1234567890'), false);
});

test('rejects an empty string header', () => {
  assert.equal(isAuthorizedCronBearer(''), false);
});
