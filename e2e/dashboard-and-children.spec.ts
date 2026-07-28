import { test, expect } from '@playwright/test';

test('adding a child through the drawer shows it on the dashboard with its default subjects', async ({ page }) => {
  const childName = `Playwright Kid ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Add child' }).click();

  const drawer = page.locator('aside.drawer.open');
  await expect(drawer).toBeVisible();
  await drawer.getByLabel("Child's name").fill(childName);
  await drawer.getByLabel('Year group / key stage (optional)').fill('Year 4');
  await drawer.getByRole('button', { name: 'Add child' }).click();

  // Drawer closes on success and the new child appears in the grid.
  await expect(drawer).not.toBeVisible();
  const card = page.locator('.card-b', { hasText: childName });
  await expect(card).toBeVisible();
  await expect(card.getByText('Year 4')).toBeVisible();
  await expect(card.getByText('No subjects logged yet')).toBeVisible();

  await card.click();
  await expect(page.getByRole('heading', { name: childName })).toBeVisible();
  for (const subject of ['English', 'Maths', 'Science', 'Wider Learning']) {
    await expect(page.getByRole('heading', { name: subject })).toBeVisible();
  }
});
