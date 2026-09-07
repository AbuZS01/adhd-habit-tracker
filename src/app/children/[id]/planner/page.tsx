import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, subjects as subjectsTable, logEntries, plannedActivities } from '@/db/schema';
import { monthGridDays, monthLabel, currentMonthIso, addMonthsIso, withCompletionStatus, computeDayStatus } from '@/lib/planner';
import PlannerDay from '@/components/PlannerDay';
import PlannerMonthGrid from '@/components/PlannerMonthGrid';

function isValidMonth(value: string): boolean {
  return /^\d{4}-\d{2}$/.test(value);
}

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; day?: string }>;
}) {
  const { id: childId } = await params;
  const { month, day } = await searchParams;
  const session = await requireSessionFamily();
  if (!session) redirect('/');

  const db = getDb();
  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, session.familyId)));

  if (!child) notFound();

  const subjects = await db
    .select({ id: subjectsTable.id, name: subjectsTable.name })
    .from(subjectsTable)
    .where(and(eq(subjectsTable.childId, childId), eq(subjectsTable.isArchived, false)))
    .orderBy(subjectsTable.sortOrder);

  const monthIso = month && isValidMonth(month) ? month : currentMonthIso();
  const gridDays = monthGridDays(monthIso);
  const gridStart = gridDays[0]!.date;
  const gridEnd = gridDays[gridDays.length - 1]!.date;

  const todayIso = new Date().toISOString().slice(0, 10);
  const selectedDay = day && isValidIsoDate(day) ? day : monthIso === currentMonthIso() ? todayIso : `${monthIso}-01`;

  const [planned, loggedEntries] = await Promise.all([
    db
      .select({
        id: plannedActivities.id,
        subjectId: plannedActivities.subjectId,
        plannedDate: plannedActivities.plannedDate,
        title: plannedActivities.title,
        completedAt: plannedActivities.completedAt,
      })
      .from(plannedActivities)
      .where(and(eq(plannedActivities.childId, childId), gte(plannedActivities.plannedDate, gridStart), lte(plannedActivities.plannedDate, gridEnd))),
    db
      .select({ subjectId: logEntries.subjectId, entryDate: logEntries.entryDate })
      .from(logEntries)
      .where(and(eq(logEntries.childId, childId), gte(logEntries.entryDate, gridStart), lte(logEntries.entryDate, gridEnd))),
  ]);

  const plannedWithStatus = withCompletionStatus(planned, loggedEntries);
  const plannedByDate = new Map<string, typeof plannedWithStatus>();
  for (const p of plannedWithStatus) {
    const list = plannedByDate.get(p.plannedDate) ?? [];
    list.push(p);
    plannedByDate.set(p.plannedDate, list);
  }

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const subjectIndexById = new Map(subjects.map((s, i) => [s.id, i]));
  const prevMonth = addMonthsIso(monthIso, -1);
  const nextMonth = addMonthsIso(monthIso, 1);

  const gridDaysWithChips = gridDays.map((d) => {
    const dayItems = plannedByDate.get(d.date) ?? [];
    return {
      date: d.date,
      dayNumber: d.dayNumber,
      inMonth: d.inMonth,
      isToday: d.date === todayIso,
      isSelected: d.date === selectedDay,
      status: computeDayStatus(dayItems.map((p) => p.completed), d.date, todayIso),
      items: dayItems.map((p) => ({
        subjectIndex: p.subjectId ? subjectIndexById.get(p.subjectId) ?? 0 : -1,
        subjectName: p.subjectId ? subjectNameById.get(p.subjectId) ?? 'Subject' : null,
        completed: p.completed,
      })),
    };
  });

  const selectedDayItems = (plannedByDate.get(selectedDay) ?? []).map((p) => ({
    ...p,
    subjectName: p.subjectId ? subjectNameById.get(p.subjectId) ?? 'Subject' : null,
  }));
  const selectedDayLabel = new Date(`${selectedDay}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'long',
    timeZone: 'UTC',
  });

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 0, fontWeight: 400 }}>{child.name}&apos;s planner</h1>
          <p className="page-sub">Plan which subjects to cover each day. Tick items off directly, or log an entry — either marks a plan as done.</p>
        </div>
      </div>

      <div className="planner-month-nav no-print">
        <Link href={`/children/${childId}/planner?month=${prevMonth}`} className="secondary-btn" aria-label="Previous month">
          ←
        </Link>
        <h2 className="planner-month-label">{monthLabel(monthIso)}</h2>
        <Link href={`/children/${childId}/planner?month=${nextMonth}`} className="secondary-btn" aria-label="Next month">
          →
        </Link>
      </div>

      {subjects.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-700)' }}>Add a subject on the child&apos;s profile to start planning.</p>
      ) : (
        <>
          <PlannerMonthGrid childId={childId} monthIso={monthIso} days={gridDaysWithChips} />
          <PlannerDay
            key={selectedDay}
            childId={childId}
            date={selectedDay}
            label={selectedDayLabel}
            subjects={subjects}
            items={selectedDayItems}
          />
        </>
      )}
    </main>
  );
}
