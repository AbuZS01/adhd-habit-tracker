/**
 * DESTRUCTIVE one-off: drops every table in the `public` schema plus the
 * Drizzle migration-tracking schema, so a subsequent `npm run db:migrate`
 * starts from a completely clean slate.
 *
 * Exists to recover a database left with incompatible leftover tables
 * from a previous, unrelated app that used the same connection string
 * (e.g. old "accounts"/"users" tables with a different shape, which
 * collide with a fresh app's migration and abort it). Only ever run this
 * against a database you're certain holds no data you need — it does not
 * ask "are you sure", it requires an explicit env var instead so it can
 * never be triggered by an accidental `npm run`.
 */
import postgres from 'postgres';

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  if (process.env.RESET_DB_CONFIRM !== 'yes') {
    console.error(
      'Refusing to run: this permanently drops every table on DATABASE_URL. ' +
        'Set RESET_DB_CONFIRM=yes to confirm you want to do this.'
    );
    process.exit(1);
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });

  const tables = await sql<{ tablename: string }[]>`
    select tablename from pg_tables where schemaname = 'public'
  `;
  console.log('Dropping tables:', tables.map((t) => t.tablename));
  for (const { tablename } of tables) {
    await sql.unsafe(`DROP TABLE IF EXISTS "public"."${tablename}" CASCADE`);
  }

  console.log('Dropping drizzle migration-tracking schema...');
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;

  console.log('Done. Now run: npm run db:migrate');
  await sql.end();
}

main().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
