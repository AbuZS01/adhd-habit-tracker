import { test, expect } from '@playwright/test';

test('adding a child through the inline card shows it on the dashboard with its default subjects', async ({ page }) => {
  const childName = `Playwright Kid ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('button', { name: 'Add a child' }).click();

  const inlineCard = page.locator('.card', { hasText: 'Add a child' });
  await expect(inlineCard).toBeVisible();
  await inlineCard.getByLabel("Child's name").fill(childName);
  await inlineCard.getByLabel('Year group / key stage (optional)').fill('Year 4');
  await inlineCard.getByRole('button', { name: 'Add child' }).click();

  // The inline card closes on success and the new child appears in the list.
  await expect(inlineCard).not.toBeVisible();
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
