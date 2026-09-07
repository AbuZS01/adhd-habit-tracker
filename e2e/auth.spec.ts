import { test, expect } from '@playwright/test';

test.describe('sign-in gate', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('signed-out visitor sees the sign-in form, not the dashboard', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Home Education Log' })).toBeVisible();
    await expect(page.getByLabel('Email address')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send me a sign-in link' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Children' })).not.toBeVisible();
  });
});

test('signed-in guardian sees the dashboard, not the sign-in form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Children' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add a child' })).toBeVisible();
});
