import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  startOfWeek,
  weekDates,
  addDaysIso,
  withCompletionStatus,
  currentMonthIso,
  addMonthsIso,
  monthLabel,
  monthGridDays,
} from '@/lib/planner';

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

test('currentMonthIso: formats a date as YYYY-MM', () => {
  assert.equal(currentMonthIso(new Date('2026-07-22T12:00:00Z')), '2026-07');
});

test('addMonthsIso: steps forward and backward, including year rollover', () => {
  assert.equal(addMonthsIso('2026-07', 1), '2026-08');
  assert.equal(addMonthsIso('2026-01', -1), '2025-12');
  assert.equal(addMonthsIso('2026-12', 1), '2027-01');
});

test('monthLabel: formats a "YYYY-MM" string as a full month + year', () => {
  assert.equal(monthLabel('2026-07'), 'July 2026');
  assert.equal(monthLabel('2027-01'), 'January 2027');
});

test('monthGridDays: pads July 2026 (starts Wed, ends Fri) to complete Monday-start weeks', () => {
  const days = monthGridDays('2026-07');

  assert.equal(days.length, 35); // 5 full weeks
  assert.equal(days.length % 7, 0);

  assert.equal(days[0]!.date, '2026-06-29');
  assert.equal(days[0]!.inMonth, false);

  const july1 = days.find((d) => d.date === '2026-07-01')!;
  assert.equal(july1.dayNumber, 1);
  assert.equal(july1.inMonth, true);

  const july31 = days.find((d) => d.date === '2026-07-31')!;
  assert.equal(july31.inMonth, true);

  assert.equal(days[days.length - 1]!.date, '2026-08-02');
  assert.equal(days[days.length - 1]!.inMonth, false);
});
