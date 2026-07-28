import { randomBytes } from 'node:crypto';
import { chromium, type FullConfig } from '@playwright/test';
import postgres from 'postgres';

/**
 * Runs once before the whole suite. Gets the test database into a known
 * empty state, seeds one signed-in guardian (mirroring what a real
 * magic-link sign-in produces: a `users` row + a database-backed session —
 * see src/lib/auth.ts), and saves the resulting session cookie as Playwright
 * storage state so every test starts already authenticated, without needing
 * a real mailbox for the email link.
 */
const SESSION_COOKIE_NAME = 'authjs.session-token';
const STORAGE_STATE_PATH = './e2e/.auth/user.json';
export const TEST_USER_EMAIL = 'e2e-guardian@example.com';

// Tables in FK-safe order isn't required with CASCADE, but listed for clarity.
const APP_TABLES = [
  'attachments',
  'log_entries',
  'planned_activities',
  'subjects',
  'children',
  'family_invites',
  'family_members',
  'families',
  'sessions',
  'accounts',
  'verification_token',
  'users',
];

export default async function globalSetup(config: FullConfig) {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set — point it at a disposable local test database before running the E2E suite.');
  }

  // This truncates every app table, so refuse to run against anything that
  // doesn't look like a local/test database unless explicitly confirmed —
  // same convention as scripts/reset-db.ts's RESET_DB_CONFIRM guard.
  const host = new URL(connectionString).hostname;
  const looksLocal = host === 'localhost' || host === '127.0.0.1';
  if (!looksLocal && process.env.E2E_DB_CONFIRM !== 'yes') {
    throw new Error(
      `Refusing to run the E2E suite against a non-local DATABASE_URL host (${host}). ` +
        'This wipes every table. Set E2E_DB_CONFIRM=yes if you are certain this is a disposable test database.'
    );
  }

  const sql = postgres(connectionString, { max: 1, prepare: false });
  try {
    await sql.unsafe(`TRUNCATE TABLE ${APP_TABLES.map((t) => `"${t}"`).join(', ')} RESTART IDENTITY CASCADE`);

    const [user] = await sql<{ id: string }[]>`
      insert into users (email, email_verified, name)
      values (${TEST_USER_EMAIL}, now(), 'E2E Guardian')
      returning id
    `;
    if (!user) throw new Error('Failed to seed the E2E test user');

    const sessionToken = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await sql`
      insert into sessions (session_token, user_id, expires)
      values (${sessionToken}, ${user.id}, ${expires})
    `;

    const baseURL = config.projects[0]?.use.baseURL as string;
    const browser = await chromium.launch(
      process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {}
    );
    const context = await browser.newContext();
    await context.addCookies([
      {
        name: SESSION_COOKIE_NAME,
        value: sessionToken,
        url: baseURL,
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    await context.storageState({ path: STORAGE_STATE_PATH });
    await browser.close();
  } finally {
    await sql.end();
  }
}
