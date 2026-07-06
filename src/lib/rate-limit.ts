import 'server-only';

/**
 * Lightweight in-memory rate limiter for write endpoints (SR-9).
 *
 * Design note: Vercel serverless functions are ephemeral/per-instance, so a
 * pure in-memory limiter is not perfectly consistent across concurrent
 * instances. Per PLAN.md section 7 ("prefer the in-DB counter first to
 * avoid adding a vendor"), this implements a fixed-window counter. For a
 * single-operator-scale app (few users, personal use) this materially
 * reduces write-flood and quota-exhaustion risk without adding a Redis
 * dependency. If load grows, swap the store below for a DB-backed counter
 * or Upstash without changing the call sites.
 */

type Bucket = { count: number; windowStart: number };

const buckets = new Map<string, Bucket>();

// Periodically purge stale buckets so the Map doesn't grow unbounded across
// a long-lived serverless instance.
const MAX_BUCKETS = 10_000;

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * @param key Unique key for the limited actor+action, e.g. `user:<id>:habits:POST`.
 * @param limit Max requests allowed within the window.
 * @param windowMs Window size in milliseconds.
 */
export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= windowMs) {
    if (buckets.size >= MAX_BUCKETS) {
      buckets.clear();
    }
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    const retryAfterMs = windowMs - (now - existing.windowStart);
    return { allowed: false, remaining: 0, retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

// Sensible defaults for each write endpoint category.
export const RATE_LIMITS = {
  habitsWrite: { limit: 30, windowMs: 60_000 }, // 30/min per user
  checkinsWrite: { limit: 60, windowMs: 60_000 }, // 60/min per user
  pushSubscribe: { limit: 10, windowMs: 60_000 }, // 10/min per user
} as const;
