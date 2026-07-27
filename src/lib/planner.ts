/**
 * Weekly planner helpers. A planned activity's "completed" state is never
 * stored — it's derived here by checking for a matching log entry, so the
 * plan and the evidence record can't drift out of sync with each other.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** The Monday (UTC) of the week containing `date`. */
export function startOfWeek(date: Date): string {
  const iso = date.toISOString().slice(0, 10);
  const dayOfWeek = new Date(`${iso}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  const offsetFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const monday = new Date(date.getTime() - offsetFromMonday * DAY_MS);
  return monday.toISOString().slice(0, 10);
}

/** The 7 calendar dates (Mon-Sun) starting from `weekStart` (a YYYY-MM-DD Monday). */
export function weekDates(weekStart: string): { date: string; label: string }[] {
  const start = new Date(`${weekStart}T00:00:00Z`);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getTime() + i * DAY_MS);
    const iso = d.toISOString().slice(0, 10);
    return { date: iso, label: WEEKDAY_LABELS[d.getUTCDay()]! };
  });
}

export function addDaysIso(dateIso: string, days: number): string {
  const d = new Date(`${dateIso}T00:00:00Z`);
  return new Date(d.getTime() + days * DAY_MS).toISOString().slice(0, 10);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function currentMonthIso(date: Date = new Date()): string {
  return date.toISOString().slice(0, 7);
}

/** Adds `delta` calendar months to a "YYYY-MM" string. */
export function addMonthsIso(monthIso: string, delta: number): string {
  const [yearStr, monthStr] = monthIso.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1 + delta;
  const d = new Date(Date.UTC(year, monthIndex, 1));
  return d.toISOString().slice(0, 7);
}

export function monthLabel(monthIso: string): string {
  const [yearStr, monthStr] = monthIso.split('-');
  return `${MONTH_NAMES[Number(monthStr) - 1]} ${yearStr}`;
}

export interface MonthGridDay {
  date: string;
  dayNumber: number;
  inMonth: boolean;
}

/**
 * Full Monday-start calendar grid for a "YYYY-MM" month, padded with the
 * trailing/leading days of the adjacent months needed to complete each
 * week — a flat list (not grouped into week arrays) since a CSS grid with
 * 7 columns auto-wraps rows on its own.
 */
export function monthGridDays(monthIso: string): MonthGridDay[] {
  const [yearStr, monthStr] = monthIso.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const firstOfMonth = new Date(Date.UTC(year, monthIndex, 1));
  const lastOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0));

  const gridStart = startOfWeek(firstOfMonth);
  const gridEnd = addDaysIso(startOfWeek(lastOfMonth), 6);

  const days: MonthGridDay[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    const cursorDate = new Date(`${cursor}T00:00:00Z`);
    days.push({
      date: cursor,
      dayNumber: cursorDate.getUTCDate(),
      inMonth: cursorDate.getUTCMonth() === monthIndex,
    });
    cursor = addDaysIso(cursor, 1);
  }
  return days;
}

export interface PlannedActivityInput {
  id: string;
  subjectId: string | null;
  plannedDate: string;
  title: string | null;
}

export interface LoggedKeyInput {
  subjectId: string | null;
  entryDate: string;
}

export interface PlannedActivityWithStatus extends PlannedActivityInput {
  completed: boolean;
}

function logKey(subjectId: string | null, date: string): string {
  return `${subjectId ?? 'general'}::${date}`;
}

/** Marks each planned activity as completed if a log entry exists for the same subject + date. */
export function withCompletionStatus(
  planned: PlannedActivityInput[],
  loggedEntries: LoggedKeyInput[],
): PlannedActivityWithStatus[] {
  const loggedKeys = new Set(loggedEntries.map((e) => logKey(e.subjectId, e.entryDate)));
  return planned.map((p) => ({
    ...p,
    completed: loggedKeys.has(logKey(p.subjectId, p.plannedDate)),
  }));
}
