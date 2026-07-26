import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeSubjectCoverage, summarizeCoverage, computeWeeklyHeatmap } from '@/lib/coverage';

const NOW = new Date('2026-07-22T12:00:00Z');

const subjects = [
  { id: 'maths', name: 'Maths' },
  { id: 'english', name: 'English' },
  { id: 'science', name: 'Science' },
];

test('computeSubjectCoverage: counts entries within the window, ignores older ones and general entries', () => {
  const entries = [
    { subjectId: 'maths', entryDate: '2026-07-20' },
    { subjectId: 'maths', entryDate: '2026-07-18' },
    { subjectId: 'english', entryDate: '2026-07-21' },
    { subjectId: 'science', entryDate: '2026-05-01' }, // outside 30-day window
    { subjectId: null, entryDate: '2026-07-22' }, // general entry, no subject
  ];

  const result = computeSubjectCoverage(subjects, entries, 30, NOW);

  const maths = result.find((s) => s.subjectId === 'maths')!;
  const english = result.find((s) => s.subjectId === 'english')!;
  const science = result.find((s) => s.subjectId === 'science')!;

  assert.equal(maths.entryCount, 2);
  assert.equal(maths.lastEntryDate, '2026-07-20');
  assert.equal(english.entryCount, 1);
  assert.equal(science.entryCount, 0);
  assert.equal(science.lastEntryDate, null);
});

test('summarizeCoverage: percent covered, most-covered and needs-focus lists', () => {
  const subjectCoverage = [
    { subjectId: 'maths', name: 'Maths', entryCount: 5, lastEntryDate: '2026-07-20' },
    { subjectId: 'english', name: 'English', entryCount: 2, lastEntryDate: '2026-07-19' },
    { subjectId: 'science', name: 'Science', entryCount: 0, lastEntryDate: null },
    { subjectId: 'history', name: 'History', entryCount: 0, lastEntryDate: null },
  ];

  const summary = summarizeCoverage(subjectCoverage);

  assert.equal(summary.coveragePercent, 50);
  assert.deepEqual(summary.mostCovered.map((s) => s.subjectId), ['maths', 'english']);
  assert.deepEqual(summary.needsFocus.map((s) => s.subjectId), ['science', 'history']);
});

test('summarizeCoverage: when every subject has entries, needsFocus falls back to the least-covered', () => {
  const subjectCoverage = [
    { subjectId: 'maths', name: 'Maths', entryCount: 5, lastEntryDate: '2026-07-20' },
    { subjectId: 'english', name: 'English', entryCount: 1, lastEntryDate: '2026-07-19' },
  ];

  const summary = summarizeCoverage(subjectCoverage);

  assert.equal(summary.coveragePercent, 100);
  assert.deepEqual(summary.needsFocus.map((s) => s.subjectId), ['english', 'maths']);
});

test('summarizeCoverage: empty subject list', () => {
  const summary = summarizeCoverage([]);
  assert.equal(summary.coveragePercent, 0);
  assert.deepEqual(summary.mostCovered, []);
  assert.deepEqual(summary.needsFocus, []);
});

test('computeWeeklyHeatmap: builds 7 oldest-to-newest days with correct per-day counts', () => {
  const entries = [
    { subjectId: 'maths', entryDate: '2026-07-22' },
    { subjectId: 'maths', entryDate: '2026-07-22' },
    { subjectId: 'maths', entryDate: '2026-07-20' },
    { subjectId: 'english', entryDate: '2026-07-15' }, // outside the 7-day window
  ];

  const rows = computeWeeklyHeatmap(subjects, entries, 7, NOW);

  assert.equal(rows.length, 3);
  const maths = rows.find((r) => r.subjectId === 'maths')!;
  assert.equal(maths.days.length, 7);
  assert.equal(maths.days[0]!.date, '2026-07-16');
  assert.equal(maths.days[6]!.date, '2026-07-22');
  assert.equal(maths.days[6]!.count, 2);
  const july20 = maths.days.find((d) => d.date === '2026-07-20')!;
  assert.equal(july20.count, 1);

  const english = rows.find((r) => r.subjectId === 'english')!;
  assert.ok(english.days.every((d) => d.count === 0));
});
