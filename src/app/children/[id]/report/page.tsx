import { notFound, redirect } from 'next/navigation';
import { eq, and, gte, lte } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, subjects as subjectsTable, logEntries } from '@/db/schema';
import PrintButton from '@/components/PrintButton';

const ACTIVITY_LABELS: Record<string, string> = {
  note: 'Note',
  work_sample: 'Work sample',
  outing: 'Outing / trip',
  resource: 'Resource used',
  assessment: 'Assessment',
  other: 'Other',
};

function isValidIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export default async function EvidenceReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const { id: childId } = await params;
  const { from, to } = await searchParams;
  const session = await requireSessionFamily();
  if (!session) redirect('/');

  const db = getDb();
  const [child] = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.id, childId), eq(childrenTable.familyId, session.familyId)));

  if (!child) notFound();

  const subjects = await db
    .select()
    .from(subjectsTable)
    .where(eq(subjectsTable.childId, childId))
    .orderBy(subjectsTable.sortOrder);

  const validFrom = from && isValidIsoDate(from) ? from : undefined;
  const validTo = to && isValidIsoDate(to) ? to : undefined;

  const conditions = [eq(logEntries.childId, childId)];
  if (validFrom) conditions.push(gte(logEntries.entryDate, validFrom));
  if (validTo) conditions.push(lte(logEntries.entryDate, validTo));

  const entries = await db
    .select()
    .from(logEntries)
    .where(and(...conditions))
    .orderBy(logEntries.entryDate);

  const entriesBySubject = new Map<string, typeof entries>();
  const generalEntries: typeof entries = [];
  for (const entry of entries) {
    if (entry.subjectId) {
      const list = entriesBySubject.get(entry.subjectId) ?? [];
      list.push(entry);
      entriesBySubject.set(entry.subjectId, list);
    } else {
      generalEntries.push(entry);
    }
  }

  return (
    <main className="container report">
      <div className="page-header no-print">
        <h1 style={{ marginBottom: 0 }}>Evidence report</h1>
        <PrintButton />
      </div>

      <form method="get" className="form-row no-print" style={{ marginBottom: '1rem' }}>
        <label>
          From
          <input type="date" name="from" defaultValue={validFrom ?? ''} />
        </label>
        <label>
          To
          <input type="date" name="to" defaultValue={validTo ?? ''} />
        </label>
        <button className="secondary-btn" type="submit" style={{ alignSelf: 'flex-end' }}>
          Filter
        </button>
      </form>

      <header className="report-header">
        <h1>{child.name}</h1>
        {child.yearGroup && <p>{child.yearGroup}</p>}
        <p>
          Period: {validFrom ? formatDate(validFrom) : 'all records'} – {validTo ? formatDate(validTo) : 'present'}
        </p>
      </header>

      {entries.length === 0 && <p>No log entries in this period.</p>}

      {subjects.map((subject) => {
        const subjectEntries = entriesBySubject.get(subject.id) ?? [];
        if (subjectEntries.length === 0) return null;
        return (
          <section className="report-subject" key={subject.id}>
            <h2>{subject.name}</h2>
            <ul>
              {subjectEntries.map((entry) => (
                <li key={entry.id}>
                  <strong>{formatDate(entry.entryDate)}</strong> — {entry.title}
                  <span className="report-type"> ({ACTIVITY_LABELS[entry.activityType] ?? entry.activityType})</span>
                  {entry.description && <p>{entry.description}</p>}
                  {entry.externalLink && <p className="report-link">{entry.externalLink}</p>}
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {generalEntries.length > 0 && (
        <section className="report-subject">
          <h2>General</h2>
          <ul>
            {generalEntries.map((entry) => (
              <li key={entry.id}>
                <strong>{formatDate(entry.entryDate)}</strong> — {entry.title}
                <span className="report-type"> ({ACTIVITY_LABELS[entry.activityType] ?? entry.activityType})</span>
                {entry.description && <p>{entry.description}</p>}
                {entry.externalLink && <p className="report-link">{entry.externalLink}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
