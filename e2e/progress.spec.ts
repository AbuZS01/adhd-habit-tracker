import { test, expect } from '@playwright/test';
import { seedChild, today } from './helpers';

test('progress page shows a coverage ring and a full 7-day heatmap for a logged subject', async ({ page, request }) => {
  const child = await seedChild(request, `Progress Kid ${Date.now()}`);
  const english = child.subjects.find((s) => s.name === 'English')!;

  await request.post('/api/entries', {
    data: { childId: child.id, subjectId: english.id, entryDate: today(), title: 'Reading log' },
  });

  await page.goto(`/children/${child.id}/progress`);

  await expect(page.locator('.coverage-ring-number')).toBeVisible();
  await expect(page.locator('.progress-subject-list', { hasText: 'English' }).first()).toBeVisible();

  // Regression check for the mobile heatmap-overflow bug: all 7 day columns
  // must be present and the grid must never be wider than the viewport
  // (previously an HTML <table> silently clipped the last 2 columns,
  // including today, with no scrollbar to reveal it).
  const heatmap = page.locator('.heatmap-grid');
  await expect(heatmap).toBeVisible();
  await expect(heatmap.locator('.heatmap-col-label')).toHaveCount(7);
  await expect(heatmap.locator('.heatmap-row-label', { hasText: 'English' })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(scrollWidth).toBeLessThanOrEqual(viewportWidth);
  await expect(heatmap.locator('.heatmap-col-label')).toHaveCount(7);
});
