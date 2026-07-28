import { test, expect } from '@playwright/test';
import path from 'node:path';
import { seedChild, today } from './helpers';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');

test('logging an entry with a subject shows it under that subject', async ({ page, request }) => {
  const child = await seedChild(request, `Log Entry Kid ${Date.now()}`);
  const maths = child.subjects.find((s) => s.name === 'Maths')!;

  await page.goto(`/children/${child.id}`);
  const form = page.locator('form.stacked').first();
  await form.getByLabel('Subject').selectOption(maths.id);
  await form.getByLabel('Title').fill('Fractions worksheet');
  // Not `getByLabel` — the label also wraps the dictation mic button ahead
  // of the textarea in the DOM, which HTML's implicit-label-association
  // rules point at instead (the first labelable descendant wins).
  await form.locator('textarea').fill('Halves and quarters, went well.');
  await form.getByRole('button', { name: 'Add entry' }).click();

  const mathsSection = page.locator('section.subject-section', { hasText: 'Maths' });
  await expect(mathsSection.getByText('Fractions worksheet')).toBeVisible();
  await expect(mathsSection.getByText('1 entry')).toBeVisible();
});

test('evidence buttons show Photo, Video and File, each scoped to its own file types', async ({ page, request }) => {
  const child = await seedChild(request, `Evidence Kid ${Date.now()}`);

  await page.goto(`/children/${child.id}`);
  const form = page.locator('form.stacked').first();
  const buttonRow = form.locator('.evidence-btn-row');
  await expect(buttonRow).toBeVisible();

  const photoBtn = buttonRow.locator('.evidence-btn', { hasText: 'Photo' });
  const videoBtn = buttonRow.locator('.evidence-btn', { hasText: 'Video' });
  const fileBtn = buttonRow.locator('.evidence-btn', { hasText: 'File' });
  await expect(photoBtn).toBeVisible();
  await expect(videoBtn).toBeVisible();
  await expect(fileBtn).toBeVisible();

  await expect(photoBtn.locator('input[type=file]')).toHaveAttribute('accept', /image\/jpeg/);
  await expect(videoBtn.locator('input[type=file]')).toHaveAttribute('accept', /video\/mp4/);
  await expect(fileBtn.locator('input[type=file]')).toHaveAttribute('accept', /application\/pdf/);

  // Selecting a file stages it (shown under the buttons) without submitting
  // the form — actually completing the upload requires a live Vercel Blob
  // endpoint, which isn't reachable from this test environment.
  await photoBtn.locator('input[type=file]').setInputFiles(path.join(FIXTURES_DIR, 'sample.jpg'));
  await expect(form.getByText('sample.jpg selected')).toBeVisible();
});

test('an entry logged for the same subject/date marks a matching plan as completed', async ({ page, request }) => {
  const child = await seedChild(request, `Plan Match Kid ${Date.now()}`);
  const english = child.subjects.find((s) => s.name === 'English')!;

  await request.post('/api/planned-activities', {
    data: { childId: child.id, subjectId: english.id, plannedDate: today(), title: 'Reading practice' },
  });

  await page.goto(`/children/${child.id}`);
  const form = page.locator('form.stacked').first();
  await form.getByLabel('Subject').selectOption(english.id);
  await form.getByLabel('Title').fill('Reading practice');
  await form.getByRole('button', { name: 'Add entry' }).click();

  await page.goto(`/children/${child.id}/planner`);
  const dayCard = page.locator('section.planner-day');
  const item = dayCard.locator('.planner-item', { hasText: 'Reading practice' });
  await expect(item.locator('.planner-item-badge')).toHaveText('Completed');
});
