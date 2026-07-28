import { test, expect } from '@playwright/test';
import { seedChild } from './helpers';

test('desktop sidebar shows child sub-nav inside a child route and links navigate correctly', async ({
  page,
  request,
}) => {
  const child = await seedChild(request, `Sidebar Kid ${Date.now()}`);

  await page.goto('/');
  await expect(page.locator('.sidebar-child-section')).toHaveCount(0);

  await page.goto(`/children/${child.id}`);
  const childSection = page.locator('.sidebar-child-section');
  await expect(childSection).toBeVisible();
  await expect(childSection.getByText(child.name)).toBeVisible();

  await childSection.getByRole('link', { name: 'Planner' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/planner`);

  await page.locator('.sidebar-child-section').getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/progress`);
});

test('mobile: hamburger opens the sidebar as a drawer, and navigating closes it', async ({ page, request }) => {
  const child = await seedChild(request, `Mobile Nav Kid ${Date.now()}`);
  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto(`/children/${child.id}`);
  const sidebar = page.locator('aside.sidebar');
  await expect(sidebar).not.toHaveClass(/mobile-open/);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(sidebar).toHaveClass(/mobile-open/);

  await sidebar.locator('.sidebar-child-section').getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/progress`);
  await expect(sidebar).not.toHaveClass(/mobile-open/);
});
