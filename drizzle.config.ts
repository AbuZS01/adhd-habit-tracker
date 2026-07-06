import type { Config } from 'drizzle-kit';

// Loaded only by the drizzle-kit CLI (dev-time), never bundled into the app.
// Falls back to a placeholder so `drizzle-kit generate` (schema diffing only,
// no DB connection) works without a live DATABASE_URL.
const connectionString = process.env.DATABASE_URL ?? 'postgres://placeholder:placeholder@localhost:5432/placeholder';

export default {
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: connectionString,
  },
  strict: true,
  verbose: true,
} satisfies Config;
