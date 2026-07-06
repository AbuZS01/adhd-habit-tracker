import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env';

/**
 * Constant-time bearer-token check for the cron dispatch endpoint (SR-7).
 * Takes a plain header-getter function rather than a framework Request
 * type so this module has no dependency on `next/server` and can be unit
 * tested in isolation.
 */
export function isAuthorizedCronBearer(authHeaderValue: string | null | undefined): boolean {
  const authHeader = authHeaderValue ?? '';
  const expected = `Bearer ${getServerEnv().CRON_SECRET}`;

  const providedBuf = Buffer.from(authHeader);
  const expectedBuf = Buffer.from(expected);

  // timingSafeEqual requires equal-length buffers. A length mismatch is not
  // a meaningful timing side-channel for a bearer token of this nature, so
  // we short-circuit on length but always use timingSafeEqual for the
  // actual content comparison to avoid short-circuiting on byte content.
  if (providedBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(providedBuf, expectedBuf);
}
