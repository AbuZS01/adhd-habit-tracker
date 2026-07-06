import { test } from 'node:test';
import assert from 'node:assert/strict';

// SR-4 / T1 fuzz test: simulates the exact authorization shape used by
// every [id] route handler — `WHERE id = ? AND user_id = ?` — against an
// in-memory dataset standing in for the habits table, and asserts that a
// user requesting another user's row always gets "not found", never the
// row's data, regardless of which id/userId combination is fuzzed.

interface FakeHabit {
  id: string;
  userId: string;
  name: string;
}

const dataset: FakeHabit[] = [
  { id: 'a1', userId: 'user-A', name: 'Take meds' },
  { id: 'a2', userId: 'user-A', name: 'Journal' },
  { id: 'b1', userId: 'user-B', name: 'Stretch' },
];

/** Mirrors the WHERE clause pattern in src/app/api/habits/[id]/route.ts. */
function findOwnedHabit(habitId: string, sessionUserId: string): FakeHabit | undefined {
  return dataset.find((h) => h.id === habitId && h.userId === sessionUserId);
}

test('user B cannot read user A habit by id (returns undefined, not the row)', () => {
  const result = findOwnedHabit('a1', 'user-B');
  assert.equal(result, undefined);
});

test('user A can read their own habit by id', () => {
  const result = findOwnedHabit('a1', 'user-A');
  assert.deepEqual(result, { id: 'a1', userId: 'user-A', name: 'Take meds' });
});

test('fuzz: every cross-owner (habitId, sessionUserId) pair returns no data', () => {
  const allIds = dataset.map((h) => h.id);
  const allUsers = Array.from(new Set(dataset.map((h) => h.userId)));

  for (const id of allIds) {
    for (const userId of allUsers) {
      const owningRow = dataset.find((h) => h.id === id);
      const isActuallyOwner = owningRow?.userId === userId;
      const result = findOwnedHabit(id, userId);

      if (isActuallyOwner) {
        assert.notEqual(result, undefined, `owner ${userId} should be able to access ${id}`);
      } else {
        assert.equal(result, undefined, `non-owner ${userId} must NOT access ${id}`);
      }
    }
  }
});

test('fuzz: random/unknown ids never match any row regardless of session user', () => {
  const unknownIds = ['does-not-exist', '', 'a1 ', ' a1', 'A1', 'null', 'undefined'];
  for (const id of unknownIds) {
    for (const userId of ['user-A', 'user-B', 'user-C']) {
      const result = findOwnedHabit(id, userId);
      assert.equal(result, undefined, `unknown id "${id}" must never resolve for ${userId}`);
    }
  }
});
