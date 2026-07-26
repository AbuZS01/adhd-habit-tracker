/**
 * Real-data coverage/progress analytics for a child's subjects — no AI
 * involved, everything derived from actual logged entry dates.
 */

export interface SubjectInput {
  id: string;
  name: string;
}

export interface EntryInput {
  subjectId: string | null;
  entryDate: string; // YYYY-MM-DD
}

export interface SubjectCoverage {
  subjectId: string;
  name: string;
  entryCount: number;
  lastEntryDate: string | null;
}

export interface CoverageSummary {
  coveragePercent: number;
  mostCovered: SubjectCoverage[];
  needsFocus: SubjectCoverage[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

function daysAgo(dateStr: string, now: Date): number {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return Math.floor((now.getTime() - d.getTime()) / DAY_MS);
}

/** Per-subject entry count and last-logged date within a rolling window. */
export function computeSubjectCoverage(
  subjects: SubjectInput[],
  entries: EntryInput[],
  windowDays: number,
  now: Date = new Date(),
): SubjectCoverage[] {
  const byId = new Map<string, SubjectCoverage>(
    subjects.map((s) => [s.id, { subjectId: s.id, name: s.name, entryCount: 0, lastEntryDate: null }]),
  );

  for (const entry of entries) {
    if (!entry.subjectId) continue;
    const row = byId.get(entry.subjectId);
    if (!row) continue;
    if (daysAgo(entry.entryDate, now) > windowDays) continue;
    row.entryCount += 1;
    if (!row.lastEntryDate || entry.entryDate > row.lastEntryDate) {
      row.lastEntryDate = entry.entryDate;
    }
  }

  return subjects.map((s) => byId.get(s.id)!);
}

/** Coverage %, plus which subjects are doing well vs. need attention. */
export function summarizeCoverage(subjectCoverage: SubjectCoverage[]): CoverageSummary {
  if (subjectCoverage.length === 0) {
    return { coveragePercent: 0, mostCovered: [], needsFocus: [] };
  }

  const covered = subjectCoverage.filter((s) => s.entryCount > 0);
  const coveragePercent = Math.round((covered.length / subjectCoverage.length) * 100);

  const mostCovered = [...covered].sort((a, b) => b.entryCount - a.entryCount).slice(0, 2);

  const uncovered = subjectCoverage.filter((s) => s.entryCount === 0);
  const needsFocus = uncovered.length > 0 ? uncovered.slice(0, 3) : [...subjectCoverage].sort((a, b) => a.entryCount - b.entryCount).slice(0, 2);

  return { coveragePercent, mostCovered, needsFocus };
}

export interface HeatmapDay {
  date: string; // YYYY-MM-DD
  label: string; // "Mon", "Tue", ...
  count: number;
}

export interface SubjectHeatmapRow {
  subjectId: string;
  name: string;
  days: HeatmapDay[];
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Last `days` calendar days (oldest first), entry count per subject per day. */
export function computeWeeklyHeatmap(
  subjects: SubjectInput[],
  entries: EntryInput[],
  days = 7,
  now: Date = new Date(),
): SubjectHeatmapRow[] {
  const dateKeys: string[] = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * DAY_MS);
    dateKeys.push(d.toISOString().slice(0, 10));
  }

  const counts = new Map<string, Map<string, number>>(subjects.map((s) => [s.id, new Map(dateKeys.map((d) => [d, 0]))]));

  for (const entry of entries) {
    if (!entry.subjectId) continue;
    const subjectCounts = counts.get(entry.subjectId);
    if (!subjectCounts || !subjectCounts.has(entry.entryDate)) continue;
    subjectCounts.set(entry.entryDate, (subjectCounts.get(entry.entryDate) ?? 0) + 1);
  }

  return subjects.map((s) => ({
    subjectId: s.id,
    name: s.name,
    days: dateKeys.map((dateKey) => ({
      date: dateKey,
      label: WEEKDAY_LABELS[new Date(`${dateKey}T00:00:00Z`).getUTCDay()]!,
      count: counts.get(s.id)?.get(dateKey) ?? 0,
    })),
  }));
}
