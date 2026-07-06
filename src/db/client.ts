import 'server-only';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Server-only DB connection (SR-1: DATABASE_URL never touches client code).
 *
 * The connection is created lazily on first use, not at module load time,
 * so that `next build` can complete in environments with no live database
 * (build-time page/route analysis must not require a DB round-trip).
 */
let queryClient: postgres.Sql | undefined;
let dbInstance: ReturnType<typeof drizzle<typeof schema>> | undefined;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Configure it in .env.local or Vercel env vars.');
  }
  return url;
}

export function getDb() {
  if (dbInstance) return dbInstance;
  queryClient = postgres(getConnectionString(), {
    // Serverless-friendly: small pool, short idle timeout.
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  dbInstance = drizzle(queryClient, { schema });
  return dbInstance;
}
