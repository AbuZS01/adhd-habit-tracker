import Link from 'next/link';
import { eq, and, inArray, count, countDistinct, max } from 'drizzle-orm';
import { auth, signIn } from '@/lib/auth';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, families as familiesTable, logEntries } from '@/db/schema';
import { getNationContent } from '@/lib/legal-content';
import { computeRecency, type RecencyTier } from '@/lib/recency';
import DashboardHeader from '@/components/DashboardHeader';
import QuickNoteCard from '@/components/QuickNoteCard';

function recencyTagClass(tier: RecencyTier): string {
  if (tier === 'good') return 'tag tag-accent';
  if (tier === 'warn') return 'tag tag-outline';
  return 'tag tag-neutral';
}

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="container">
        <h1 style={{ fontWeight: 400 }}>Home Education Log</h1>
        <p style={{ color: 'var(--color-neutral-700)' }}>
          Track each child&apos;s subjects and keep a dated record of their learning — for your own peace of
          mind, and as evidence if your Local Authority asks about your child&apos;s education.
        </p>

        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Sign in</h2>
          {process.env.EMAIL_SERVER && process.env.EMAIL_FROM && (
            <form
              className="stacked"
              action={async (formData: FormData) => {
                'use server';
                await signIn('nodemailer', formData);
              }}
            >
              <label>
                Email address
                <input type="email" name="email" required placeholder="you@example.com" />
              </label>
              <button className="btn btn-primary btn-block" type="submit">
                Send me a sign-in link
              </button>
            </form>
          )}
          {process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET && (
            <>
              <hr />
              <form
                action={async () => {
                  'use server';
                  await signIn('github');
                }}
              >
                <button className="btn btn-secondary btn-block" type="submit">
                  Sign in with GitHub
                </button>
              </form>
            </>
          )}
        </section>
      </main>
    );
  }

  const familySession = await requireSessionFamily();
  if (!familySession) {
    return (
      <main className="container">
        <p>Something went wrong loading your account. Please try signing in again.</p>
      </main>
    );
  }

  const db = getDb();
  const childRows = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.familyId, familySession.familyId), eq(childrenTable.isArchived, false)))
    .orderBy(childrenTable.createdAt);

  const [family] = await db
    .select({ nation: familiesTable.nation })
    .from(familiesTable)
    .where(eq(familiesTable.id, familySession.familyId));

  const childIds = childRows.map((c) => c.id);
  const statRows = childIds.length
    ? await db
        .select({
          childId: logEntries.childId,
          entryCount: count(logEntries.id),
          subjectCount: countDistinct(logEntries.subjectId),
          lastEntryDate: max(logEntries.entryDate),
        })
        .from(logEntries)
        .where(inArray(logEntries.childId, childIds))
        .groupBy(logEntries.childId)
    : [];
  const statsByChild = new Map(statRows.map((s) => [s.childId, s]));

  return (
    <main className="container">
      <DashboardHeader
        sub={
          family?.nation ? (
            <p className="page-sub">
              {getNationContent(family.nation).legalStandard} Full details on each child&apos;s evidence report.
            </p>
          ) : (
            <p className="page-sub">
              <Link href="/family">Set your nation</Link> to see the right home-education legal information for
              where you live.
            </p>
          )
        }
      />

      {childRows.length === 0 ? (
        <p style={{ color: 'var(--color-neutral-700)' }}>
          Add your first child&apos;s profile to start logging subjects and evidence.
        </p>
      ) : (
        <QuickNoteCard childOptions={childRows.map((c) => ({ id: c.id, name: c.name }))} />
      )}

      <div className="grid">
        {childRows.map((child) => {
          const stats = statsByChild.get(child.id);
          const entryCount = stats?.entryCount ?? 0;
          const subjectCount = stats?.subjectCount ?? 0;
          const recency = computeRecency(stats?.lastEntryDate ?? null);

          return (
            <Link key={child.id} href={`/children/${child.id}`} className="card card-b">
              <div className="card-b-body">
                <div className="card-b-row">
                  <div>
                    {child.yearGroup && <p className="card-year">{child.yearGroup}</p>}
                    <p className="card-name">{child.name}</p>
                  </div>
                  <span className="chevron" aria-hidden="true">
                    ›
                  </span>
                </div>
                <p className="b-sub">
                  {subjectCount === 0 ? 'No subjects logged yet' : `${subjectCount} subject${subjectCount === 1 ? '' : 's'} logged`}
                  {entryCount > 0 && ` · ${entryCount} ${entryCount === 1 ? 'entry' : 'entries'}`}
                </p>
                <span className={recencyTagClass(recency.tier)}>{recency.label}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
