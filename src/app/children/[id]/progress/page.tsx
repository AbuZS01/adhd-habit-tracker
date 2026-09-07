import { Fragment } from 'react';
import { notFound, redirect } from 'next/navigation';
import { eq, and, gte } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, subjects as subjectsTable, logEntries } from '@/db/schema';
import { computeSubjectCoverage, summarizeCoverage, computeWeeklyHeatmap } from '@/lib/coverage';

const COVERAGE_WINDOW_DAYS = 30;
const HEATMAP_DAYS = 7;
const RING_RADIUS = 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function heatIntensityClass(count: number): string {
  if (count === 0) return 'heat-0';
  if (count === 1) return 'heat-1';
  return 'heat-2';
}

export default async function ChildProgressPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: childId } = await params;
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

  const windowStart = new Date();
  windowStart.setUTCDate(windowStart.getUTCDate() - Math.max(COVERAGE_WINDOW_DAYS, HEATMAP_DAYS) - 1);
  const windowStartIso = windowStart.toISOString().slice(0, 10);

  const recentEntries = await db
    .select({ subjectId: logEntries.subjectId, entryDate: logEntries.entryDate })
    .from(logEntries)
    .where(and(eq(logEntries.childId, childId), gte(logEntries.entryDate, windowStartIso)));

  const subjectCoverage = computeSubjectCoverage(subjects, recentEntries, COVERAGE_WINDOW_DAYS);
  const { coveragePercent, mostCovered, needsFocus } = summarizeCoverage(subjectCoverage);
  const heatmapRows = computeWeeklyHeatmap(subjects, recentEntries, HEATMAP_DAYS);
  const dashOffset = RING_CIRCUMFERENCE * (1 - coveragePercent / 100);

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 0, fontWeight: 400 }}>{child.name}&apos;s progress</h1>
          <p className="page-sub">Subject coverage over the last {COVERAGE_WINDOW_DAYS} days, from your own log entries.</p>
        </div>
      </div>

      {subjects.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-700)' }}>Add a subject on the child&apos;s profile to see progress here.</p>
      ) : (
        <>
          <section className="card progress-summary">
            <div className="coverage-ring">
              <svg viewBox="0 0 96 96" width="96" height="96">
                <circle className="ring-track" cx="48" cy="48" r={RING_RADIUS} fill="none" strokeWidth="8" />
                {coveragePercent > 0 && (
                  <circle
                    cx="48"
                    cy="48"
                    r={RING_RADIUS}
                    fill="none"
                    className="ring-fill ring-good"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                  />
                )}
              </svg>
              <span className="coverage-ring-number">{coveragePercent}%</span>
            </div>
            <div className="progress-summary-lists">
              <div>
                <h3>Most covered</h3>
                {mostCovered.length === 0 ? (
                  <p className="b-sub">Nothing logged yet in this window.</p>
                ) : (
                  <ul className="progress-subject-list">
                    {mostCovered.map((s) => (
                      <li key={s.subjectId}>
                        <span className="dot good" /> {s.name}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3>Needs more focus</h3>
                <ul className="progress-subject-list">
                  {needsFocus.map((s) => (
                    <li key={s.subjectId}>
                      <span className="dot stale" /> {s.name}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section className="card">
            <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Last {HEATMAP_DAYS} days</h2>
            <div className="heatmap-grid" style={{ gridTemplateColumns: `minmax(72px, auto) repeat(${HEATMAP_DAYS}, 1fr)` }}>
              <span />
              {heatmapRows[0]?.days.map((d) => (
                <span key={d.date} className="heatmap-col-label">
                  {d.label}
                </span>
              ))}
              {heatmapRows.map((row) => (
                <Fragment key={row.subjectId}>
                  <span className="heatmap-row-label">{row.name}</span>
                  {row.days.map((d) => (
                    <span key={d.date} className="heatmap-cell-wrap">
                      <span
                        className={`heat-cell ${heatIntensityClass(d.count)}`}
                        title={`${row.name}, ${d.date}: ${d.count} ${d.count === 1 ? 'entry' : 'entries'}`}
                      />
                    </span>
                  ))}
                </Fragment>
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
