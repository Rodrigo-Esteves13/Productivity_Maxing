import { test, expect } from '@playwright/test';

test.describe('tasks', () => {
  test('creates a task and it shows up in the list', async ({ page }) => {
    await page.goto('/tasks');

    await page.getByRole('button', { name: /\+ new task/i }).click();

    // A title unique per run - avoids collisions with a previous run's
    // leftover data and makes the assertion below unambiguous.
    const title = `E2E test task ${Date.now()}`;
    await page.getByLabel('Title').fill(title);
    // Date/Area are left at whatever the form defaults to (today's date,
    // first Area) - this test is checking the create flow works end to
    // end, not exercising every field combination.

    await page.getByRole('button', { name: /create task/i }).click();

    await expect(page.getByText(title)).toBeVisible();
  });
});
