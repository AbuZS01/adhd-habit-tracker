/**
 * One-off diagnostic: prints which host/database a DATABASE_URL actually
 * connects to, and what tables exist there. Used to verify that a local
 * `npm run db:migrate` run landed on the same database the deployed app
 * reads from at runtime, when the two appear to disagree.
 */
import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  let hostForDisplay = '(could not parse)';
  try {
    const parsed = new URL(connectionString);
    hostForDisplay = `${parsed.hostname}${parsed.pathname}`;
  } catch {
    // ignore — still try to connect below
  }
  console.log('Connecting to host/db:', hostForDisplay);

  const sql = postgres(connectionString, { max: 1, prepare: false });

  const [dbInfo] = await sql<{ current_database: string; current_user: string }[]>`
    select current_database(), current_user
  `;
  console.log('current_database():', dbInfo?.current_database);
  console.log('current_user:', dbInfo?.current_user);

  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public' order by tablename
  `;
  console.log('Tables in public schema:', tables.map((t) => t.tablename));

  await sql.end();
}

main().catch((err) => {
  console.error('Check failed:', err);
  process.exit(1);
});
