import { defineConfig, devices } from '@playwright/test';

/**
 * Small E2E suite covering the app's core flows (auth session, add child,
 * log entry + evidence buttons, planner, progress, sidebar navigation).
 * Runs against a production build (`next build && next start`), not `next
 * dev` — dev mode's on-demand route compilation can trigger a full-page
 * Fast Refresh reload right after the first navigation to a route, which
 * silently discards in-flight interactions/form state. global-setup.ts
 * seeds a signed-in session directly in the database so tests don't depend
 * on a real mailbox for the magic-link flow.
 */
const PORT = process.env.E2E_PORT ?? '3100';
const baseURL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    storageState: './e2e/.auth/user.json',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Pins to the sandbox-preinstalled Chromium when its revision
        // doesn't match what this @playwright/test version would otherwise
        // try to download (no browser download is available in CI here).
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    env: {
      BLOB_READ_WRITE_TOKEN: process.env.BLOB_READ_WRITE_TOKEN ?? 'vercel_blob_rw_dummy_e2e_test_token',
      AUTH_URL: baseURL,
    },
  },
});
