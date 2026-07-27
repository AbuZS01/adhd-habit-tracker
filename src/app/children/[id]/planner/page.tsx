import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, subjects as subjectsTable, logEntries, plannedActivities } from '@/db/schema';
import { startOfWeek, weekDates, addDaysIso, withCompletionStatus } from '@/lib/planner';
import PlannerDay from '@/components/PlannerDay';
import PlannerWeekGrid from '@/components/PlannerWeekGrid';

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export default async function PlannerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { id: childId } = await params;
  const { week } = await searchParams;
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

  const weekStart = week && isValidIsoDate(week) ? week : startOfWeek(new Date());
  const days = weekDates(weekStart);
  const weekEnd = days[6]!.date;

  const [planned, loggedEntries] = await Promise.all([
    db
      .select({
        id: plannedActivities.id,
        subjectId: plannedActivities.subjectId,
        plannedDate: plannedActivities.plannedDate,
        title: plannedActivities.title,
      })
      .from(plannedActivities)
      .where(and(eq(plannedActivities.childId, childId), gte(plannedActivities.plannedDate, weekStart), lte(plannedActivities.plannedDate, weekEnd))),
    db
      .select({ subjectId: logEntries.subjectId, entryDate: logEntries.entryDate })
      .from(logEntries)
      .where(and(eq(logEntries.childId, childId), gte(logEntries.entryDate, weekStart), lte(logEntries.entryDate, weekEnd))),
  ]);

  const plannedWithStatus = withCompletionStatus(planned, loggedEntries);
  const plannedByDate = new Map<string, typeof plannedWithStatus>();
  for (const p of plannedWithStatus) {
    const list = plannedByDate.get(p.plannedDate) ?? [];
    list.push(p);
    plannedByDate.set(p.plannedDate, list);
  }

  const subjectNameById = new Map(subjects.map((s) => [s.id, s.name]));
  const prevWeek = addDaysIso(weekStart, -7);
  const nextWeek = addDaysIso(weekStart, 7);
  const todayIso = new Date().toISOString().slice(0, 10);
  const isCurrentWeek = weekStart === startOfWeek(new Date());

  const gridDays = days.map((day) => ({
    date: day.date,
    label: day.label,
    dayNumber: new Date(`${day.date}T00:00:00Z`).getUTCDate().toString(),
    isToday: day.date === todayIso,
    items: (plannedByDate.get(day.date) ?? []).map((p) => ({
      subjectName: p.subjectId ? subjectNameById.get(p.subjectId) ?? 'Subject' : null,
      completed: p.completed,
    })),
  }));

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 0 }}>{child.name}&apos;s planner</h1>
          <p className="page-sub">Plan which subjects to cover each day; entries you log automatically mark a plan as done.</p>
        </div>
      </div>

      <div className="planner-week-nav no-print">
        <Link href={`/children/${childId}/planner?week=${prevWeek}`} className="secondary-btn">
          ← Previous week
        </Link>
        <span className="page-sub" style={{ margin: 0 }}>
          {isCurrentWeek ? 'This week' : `Week of ${weekStart}`}
        </span>
        <Link href={`/children/${childId}/planner?week=${nextWeek}`} className="secondary-btn">
          Next week →
        </Link>
      </div>

      {subjects.length === 0 ? (
        <p style={{ color: 'var(--text-muted)' }}>Add a subject on the child&apos;s profile to start planning.</p>
      ) : (
        <>
          <PlannerWeekGrid days={gridDays} />
          {days.map((day) => (
            <PlannerDay
              key={day.date}
              childId={childId}
              date={day.date}
              label={day.label}
              subjects={subjects}
              items={(plannedByDate.get(day.date) ?? []).map((p) => ({
                ...p,
                subjectName: p.subjectId ? subjectNameById.get(p.subjectId) ?? 'Subject' : null,
              }))}
            />
          ))}
        </>
      )}
    </main>
  );
}
