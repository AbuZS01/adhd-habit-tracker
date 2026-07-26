import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { eq, and, inArray } from 'drizzle-orm';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, subjects as subjectsTable, logEntries, attachments as attachmentsTable } from '@/db/schema';
import LogEntryForm from '@/components/LogEntryForm';
import LogEntryItem from '@/components/LogEntryItem';
import ManageSubjects from '@/components/ManageSubjects';
import EditChildForm from '@/components/EditChildForm';
import { computeRecency } from '@/lib/recency';

export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
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
    .select()
    .from(subjectsTable)
    .where(and(eq(subjectsTable.childId, childId), eq(subjectsTable.isArchived, false)))
    .orderBy(subjectsTable.sortOrder);

  const entries = await db
    .select()
    .from(logEntries)
    .where(eq(logEntries.childId, childId))
    .orderBy(logEntries.entryDate);

  const entryIds = entries.map((e) => e.id);
  const allAttachments = entryIds.length
    ? await db
        .select()
        .from(attachmentsTable)
        .where(inArray(attachmentsTable.logEntryId, entryIds))
        .orderBy(attachmentsTable.createdAt)
    : [];
  const attachmentsByEntry = new Map<string, typeof allAttachments>();
  for (const attachment of allAttachments) {
    const list = attachmentsByEntry.get(attachment.logEntryId) ?? [];
    list.push(attachment);
    attachmentsByEntry.set(attachment.logEntryId, list);
  }

  const uploadsEnabled = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

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
  // Most recent first within each group.
  for (const list of entriesBySubject.values()) list.reverse();
  generalEntries.reverse();

  return (
    <main className="container">
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: 0 }}>{child.name}</h1>
          {child.yearGroup && <p style={{ margin: 0, color: 'var(--text-muted)' }}>{child.yearGroup}</p>}
          <EditChildForm
            child={{
              id: child.id,
              name: child.name,
              yearGroup: child.yearGroup,
              notes: child.notes,
            }}
          />
        </div>
        <div className="page-header-actions no-print">
          <Link href={`/children/${childId}/progress`} className="secondary-btn">
            Progress
          </Link>
          <Link href={`/children/${childId}/report`} className="secondary-btn">
            Evidence report
          </Link>
        </div>
      </div>

      <section className="card no-print">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Add a log entry</h2>
        <LogEntryForm
          childId={childId}
          subjects={subjects.map((s) => ({ id: s.id, name: s.name }))}
          uploadsEnabled={uploadsEnabled}
        />
      </section>

      <ManageSubjects childId={childId} subjects={subjects.map((s) => ({ id: s.id, name: s.name }))} />

      {subjects.map((subject) => {
        const subjectEntries = entriesBySubject.get(subject.id) ?? [];
        const recency = computeRecency(subjectEntries[0]?.entryDate ?? null);
        return (
          <section className="card subject-section" key={subject.id}>
            <div className="subject-header">
              <h2 style={{ margin: 0, fontSize: '1.05rem' }}>{subject.name}</h2>
              <div className="subject-header-meta">
                <span className={`dot ${recency.tier === 'none' ? 'stale' : recency.tier}`} />
                {subjectEntries.length} {subjectEntries.length === 1 ? 'entry' : 'entries'}
              </div>
            </div>
            {subjectEntries.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No entries logged yet.</p>
            ) : (
              <ul className="entry-list">
                {subjectEntries.map((entry) => (
                  <LogEntryItem
                    key={entry.id}
                    entry={entry}
                    attachments={attachmentsByEntry.get(entry.id) ?? []}
                    uploadsEnabled={uploadsEnabled}
                  />
                ))}
              </ul>
            )}
          </section>
        );
      })}

      {generalEntries.length > 0 && (
        <section className="card subject-section">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>General</h2>
          <ul className="entry-list">
            {generalEntries.map((entry) => (
              <LogEntryItem
                key={entry.id}
                entry={entry}
                attachments={attachmentsByEntry.get(entry.id) ?? []}
                uploadsEnabled={uploadsEnabled}
              />
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
