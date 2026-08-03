import { defineConfig, devices } from '@playwright/test';

// BASE_URL defaults to the local Vite dev server. Point it at a Netlify
// deploy preview URL in CI (see .github/workflows/ci.yml) to run the same
// suite against a real preview deploy instead of localhost.
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }], ['github']] : 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Logs in once and saves the resulting cookies to
    // e2e/.auth/user.json - runs before every other project (see
    // `dependencies` below). Not itself a test file with expect()
    // assertions on the login UI - that's auth.spec.ts, which
    // deliberately does NOT depend on this setup project, so a broken
    // login flow still gets caught even though this setup step would
    // also fail.
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: 'auth-flow',
      testMatch: /auth\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'authenticated',
      testIgnore: /auth\.(spec|setup)\.ts/,
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Starts the Vite dev server automatically when running locally -
  // skipped in CI, where the workflow starts (and waits on) the server
  // itself so it can also run the backend alongside it.
  webServer: process.env.CI
    ? undefined
    : {
        command: 'npm run dev',
        url: baseURL,
        reuseExistingServer: true,
      },
});
