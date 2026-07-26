import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startOfWeek, weekDates, addDaysIso, withCompletionStatus } from '@/lib/planner';

test('startOfWeek: finds the Monday for a mid-week date', () => {
  // 2026-07-22 is a Wednesday.
  assert.equal(startOfWeek(new Date('2026-07-22T12:00:00Z')), '2026-07-20');
});

test('startOfWeek: a Sunday belongs to the week that started the previous Monday', () => {
  // 2026-07-26 is a Sunday.
  assert.equal(startOfWeek(new Date('2026-07-26T12:00:00Z')), '2026-07-20');
});

test('startOfWeek: a Monday is its own week start', () => {
  assert.equal(startOfWeek(new Date('2026-07-20T12:00:00Z')), '2026-07-20');
});

test('weekDates: returns 7 consecutive days Monday through Sunday', () => {
  const days = weekDates('2026-07-20');
  assert.equal(days.length, 7);
  assert.deepEqual(
    days.map((d) => d.date),
    ['2026-07-20', '2026-07-21', '2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26'],
  );
  assert.equal(days[0]!.label, 'Monday');
  assert.equal(days[6]!.label, 'Sunday');
});

test('addDaysIso: adds and subtracts days across month boundaries', () => {
  assert.equal(addDaysIso('2026-07-28', 7), '2026-08-04');
  assert.equal(addDaysIso('2026-08-04', -7), '2026-07-28');
});

test('withCompletionStatus: matches on subject + date, general plans match null-subject entries', () => {
  const planned = [
    { id: 'p1', subjectId: 'maths', plannedDate: '2026-07-20', title: 'Fractions' },
    { id: 'p2', subjectId: 'science', plannedDate: '2026-07-20', title: null },
    { id: 'p3', subjectId: null, plannedDate: '2026-07-21', title: 'Museum trip' },
  ];
  const logged = [
    { subjectId: 'maths', entryDate: '2026-07-20' },
    { subjectId: null, entryDate: '2026-07-21' },
  ];

  const result = withCompletionStatus(planned, logged);

  assert.equal(result.find((p) => p.id === 'p1')!.completed, true);
  assert.equal(result.find((p) => p.id === 'p2')!.completed, false);
  assert.equal(result.find((p) => p.id === 'p3')!.completed, true);
});
