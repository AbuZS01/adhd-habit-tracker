import { test, expect } from '@playwright/test';
import { seedChild, today, daysAgo } from './helpers';

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

test('ticking a planned item off marks it completed without needing a log entry', async ({ page, request }) => {
  const child = await seedChild(request, `Tick Off Kid ${Date.now()}`);
  const english = child.subjects.find((s) => s.name === 'English')!;

  await request.post('/api/planned-activities', {
    data: { childId: child.id, subjectId: english.id, plannedDate: today(), title: 'Phonics practice' },
  });

  await page.goto(`/children/${child.id}/planner`);
  const item = page.locator('.planner-item', { hasText: 'Phonics practice' });
  await expect(item.locator('.planner-item-badge')).toHaveText('Not started');

  await item.getByRole('button', { name: 'Mark as completed' }).click();
  await expect(item.locator('.planner-item-badge')).toHaveText('Completed');

  const todayStatus = page.locator(`.planner-month-day[href*="day=${today()}"] .planner-month-day-status`);
  await expect(todayStatus).toHaveClass(/completed/);

  // Unticking flips it back.
  await item.getByRole('button', { name: 'Mark as not started' }).click();
  await expect(item.locator('.planner-item-badge')).toHaveText('Not started');
});

test('the calendar marks a past day with nothing done as missed, and a day with some items done as partial', async ({
  page,
  request,
}) => {
  const child = await seedChild(request, `Day Status Kid ${Date.now()}`);
  const maths = child.subjects.find((s) => s.name === 'Maths')!;
  const science = child.subjects.find((s) => s.name === 'Science')!;

  const missedDay = daysAgo(2);
  const partialDay = daysAgo(1);

  await request.post('/api/planned-activities', {
    data: { childId: child.id, subjectId: maths.id, plannedDate: missedDay, title: 'Untouched plan' },
  });

  const [doneRes, pendingRes] = await Promise.all([
    request.post('/api/planned-activities', {
      data: { childId: child.id, subjectId: maths.id, plannedDate: partialDay, title: 'Done half' },
    }),
    request.post('/api/planned-activities', {
      data: { childId: child.id, subjectId: science.id, plannedDate: partialDay, title: 'Pending half' },
    }),
  ]);
  const { plannedActivity: done } = await doneRes.json();
  await request.patch(`/api/planned-activities/${done.id}`, { data: { completed: true } });
  await pendingRes.json();

  // Navigate with an explicit month so this still works if "today" happens
  // to fall on the 1st/2nd of a month (which would otherwise push one of
  // these dates into the previous month's grid, outside the default view).
  await page.goto(`/children/${child.id}/planner?month=${missedDay.slice(0, 7)}`);

  const missedStatus = page.locator(`.planner-month-day[href*="day=${missedDay}"] .planner-month-day-status`);
  await expect(missedStatus).toHaveClass(/missed/);

  const partialStatus = page.locator(`.planner-month-day[href*="day=${partialDay}"] .planner-month-day-status`);
  await expect(partialStatus).toHaveClass(/partial/);
});
