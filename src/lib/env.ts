import { z } from 'zod';

/**
 * Server-only, zod-validated environment loader (SR-1).
 *
 * This module must never be imported from a client component. Importing
 * `server-only` below makes any accidental client import a build-time error.
 */
import 'server-only';

const serverEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  AUTH_SECRET: z.string().min(16, 'AUTH_SECRET must be at least 16 characters'),
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  AUTH_URL: z.string().url().optional(),
  VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY is required'),
  VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY is required'),
  VAPID_SUBJECT: z
    .string()
    .refine((v) => v.startsWith('mailto:') || v.startsWith('https://'), {
      message: 'VAPID_SUBJECT must be a mailto: or https: URI',
    }),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be at least 16 characters'),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

/**
 * Lazily validates and returns server environment variables. Lazy (not
 * top-level) so that `next build` can complete in environments without a
 * live DATABASE_URL (e.g. CI, this sandbox) as long as nothing that needs
 * the DB actually executes at build time. Any route/module that *uses*
 * secrets calls this at request time, which fails fast with a clear error
 * if misconfigured, rather than silently running with `undefined`.
 */
export function getServerEnv(): ServerEnv {
  if (cached) return cached;
  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid server environment configuration: ${issues}`);
  }
  cached = parsed.data;
  return cached;
}

/**
 * Public env values that are safe (and required) to reach the client bundle.
 * NEXT_PUBLIC_* vars are inlined at build time by Next.js; only the VAPID
 * *public* key belongs here. Never add a secret to this schema (SR-1).
 */
const publicEnvSchema = z.object({
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z.string().min(1, 'NEXT_PUBLIC_VAPID_PUBLIC_KEY is required'),
});

export function getPublicEnv() {
  const parsed = publicEnvSchema.safeParse({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  });
  if (!parsed.success) {
    // Do not throw hard in client-rendered paths; return empty and let the
    // caller degrade gracefully (push subscribe button disabled).
    return { NEXT_PUBLIC_VAPID_PUBLIC_KEY: '' };
  }
  return parsed.data;
}
