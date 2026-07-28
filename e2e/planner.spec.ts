import { test, expect } from '@playwright/test';
import { seedChild, today } from './helpers';

test('adding a plan for today shows a chip on the month calendar and flips to completed once logged', async ({
  page,
  request,
}) => {
  const child = await seedChild(request, `Planner Kid ${Date.now()}`);
  const science = child.subjects.find((s) => s.name === 'Science')!;

  await page.goto(`/children/${child.id}/planner`);

  const dayCard = page.locator('section.planner-day');
  await dayCard.getByLabel('Subject').selectOption(science.id);
  await dayCard.getByLabel('Plan note').fill('Volcano experiment');
  await dayCard.getByRole('button', { name: 'Add to plan' }).click();

  const item = dayCard.locator('.planner-item', { hasText: 'Volcano experiment' });
  await expect(item.locator('.planner-item-badge')).toHaveText('Not started');

  const todayCell = page.locator(`.planner-month-day[href*="day=${today()}"]`);
  const chip = todayCell.locator('.planner-month-chip', { hasText: 'Science' });
  await expect(chip).toBeVisible();
  await expect(chip).not.toHaveClass(/done/);

  // Logging matching evidence should mark the plan completed without any
  // extra step — completion is derived, never stored directly.
  await request.post('/api/entries', {
    data: { childId: child.id, subjectId: science.id, entryDate: today(), title: 'Volcano experiment done' },
  });
  await page.reload();

  const updatedItem = page.locator('.planner-item', { hasText: 'Volcano experiment' });
  await expect(updatedItem.locator('.planner-item-badge')).toHaveText('Completed');
  const updatedChip = page.locator(`.planner-month-day[href*="day=${today()}"] .planner-month-chip`, {
    hasText: 'Science',
  });
  await expect(updatedChip).toHaveClass(/done/);
});
