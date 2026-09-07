import { test, expect } from '@playwright/test';
import { seedChild } from './helpers';

test('hamburger drawer shows child sub-nav inside a child route and links navigate correctly', async ({ page, request }) => {
  const child = await seedChild(request, `Nav Kid ${Date.now()}`);

  await page.goto('/');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(page.locator('.nav-drawer-child-section')).toHaveCount(0);
  await page.keyboard.press('Escape');

  await page.goto(`/children/${child.id}`);
  await page.getByRole('button', { name: 'Open menu' }).click();
  const childSection = page.locator('.nav-drawer-child-section');
  await expect(childSection).toBeVisible();
  await expect(childSection.getByText(child.name)).toBeVisible();

  await childSection.getByRole('link', { name: 'Planner' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/planner`);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.locator('.nav-drawer-child-section').getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/progress`);
});

test('the drawer closes on navigation and on Escape', async ({ page, request }) => {
  const child = await seedChild(request, `Drawer Kid ${Date.now()}`);
  await page.goto(`/children/${child.id}`);

  const drawer = page.locator('aside.nav-drawer');
  await expect(drawer).not.toHaveClass(/open/);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await expect(drawer).toHaveClass(/open/);

  await page.keyboard.press('Escape');
  await expect(drawer).not.toHaveClass(/open/);

  await page.getByRole('button', { name: 'Open menu' }).click();
  await drawer.locator('.nav-drawer-child-section').getByRole('link', { name: 'Progress' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/progress`);
  await expect(drawer).not.toHaveClass(/open/);
});

test('bottom tab bar navigates to Children/Planner/Evidence/Family, remembering the last visited child', async ({
  page,
  request,
}) => {
  const child = await seedChild(request, `Tab Bar Kid ${Date.now()}`);
  const tabBar = page.locator('nav.bottom-tab-bar');

  // From the dashboard, with no child visited yet, Planner/Evidence fall back to '/'.
  await page.goto('/');
  await expect(tabBar.getByRole('link', { name: 'Children' })).toHaveClass(/active/);

  // Visiting a child's route remembers it for the tab bar.
  await page.goto(`/children/${child.id}`);
  await tabBar.getByRole('link', { name: 'Planner' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/planner`);
  await expect(tabBar.getByRole('link', { name: 'Planner' })).toHaveClass(/active/);

  await tabBar.getByRole('link', { name: 'Evidence' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/report`);

  await tabBar.getByRole('link', { name: 'Family' }).click();
  await expect(page).toHaveURL('/family');

  // Back on the dashboard, Planner still remembers the last child (via localStorage).
  await tabBar.getByRole('link', { name: 'Children' }).click();
  await tabBar.getByRole('link', { name: 'Planner' }).click();
  await expect(page).toHaveURL(`/children/${child.id}/planner`);
});
