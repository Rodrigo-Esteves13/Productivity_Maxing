import { test as setup, expect } from '@playwright/test';

const AUTH_FILE = 'e2e/.auth/user.json';

// A pre-seeded test account, not a real user's - never point this at a
// production login. See e2e/README.md for how to seed one against a
// local/test database.
const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

setup('authenticate', async ({ page }) => {
  if (!EMAIL || !PASSWORD) {
    throw new Error(
      'E2E_TEST_EMAIL / E2E_TEST_PASSWORD are not set - see e2e/README.md for how to seed a test account.',
    );
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(EMAIL);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: /log ?in/i }).click();

  await expect(page).toHaveURL(/\/dashboard/);
  await page.context().storageState({ path: AUTH_FILE });
});
