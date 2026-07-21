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
  AUTH_URL: z.string().url().optional(),
  // Email magic-link sign-in (primary provider — realistic for parents who
  // may not have a GitHub account). SMTP connection string, e.g.
  // smtp://user:pass@smtp.example.com:587
  EMAIL_SERVER: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(1).optional(),
  // Optional secondary provider.
  AUTH_GITHUB_ID: z.string().min(1).optional(),
  AUTH_GITHUB_SECRET: z.string().min(1).optional(),
  // Optional: enables photo/PDF evidence uploads. The @vercel/blob SDK
  // reads this from process.env directly wherever it's called; it's
  // listed here too so this schema documents the full set of optional
  // configuration, matching EMAIL_SERVER/AUTH_GITHUB_ID above.
  BLOB_READ_WRITE_TOKEN: z.string().min(1).optional(),
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
