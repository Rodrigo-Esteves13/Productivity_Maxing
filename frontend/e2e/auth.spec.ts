import { test, expect } from '@playwright/test';

const EMAIL = process.env.E2E_TEST_EMAIL;
const PASSWORD = process.env.E2E_TEST_PASSWORD;

test.describe('login', () => {
  test('shows an error on wrong credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-a-real-account@example.com');
    await page.getByLabel('Password').fill('wrong-password');
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
    // Still on the login page - a failed login must not navigate away.
    await expect(page).toHaveURL(/\/login/);
  });

  test('logs in and lands on the dashboard', async ({ page }) => {
    test.skip(!EMAIL || !PASSWORD, 'E2E_TEST_EMAIL / E2E_TEST_PASSWORD not set - see e2e/README.md');

    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL!);
    await page.getByLabel('Password').fill(PASSWORD!);
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    // The Program/Period selector bar only renders on Dashboard/Tasks
    // once academic data has loaded (see PageLayout.tsx) - a reasonable
    // "the dashboard actually finished loading" signal beyond just the
    // URL having changed.
    await expect(page.getByRole('combobox', { name: /active program/i })).toBeVisible();
  });
});
