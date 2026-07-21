import Link from 'next/link';
import { eq, and } from 'drizzle-orm';
import { auth, signIn } from '@/lib/auth';
import { requireSessionFamily } from '@/lib/family';
import { getDb } from '@/db/client';
import { children as childrenTable, families as familiesTable } from '@/db/schema';
import { getNationContent } from '@/lib/legal-content';
import AddChildForm from '@/components/AddChildForm';

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    return (
      <main className="container">
        <h1>Home Education Log</h1>
        <p style={{ color: 'var(--text-muted)' }}>
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
              <button className="primary-btn" type="submit">
                Send me a sign-in link
              </button>
            </form>
          )}
          {process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET && (
            <form
              style={{ marginTop: '0.75rem' }}
              action={async () => {
                'use server';
                await signIn('github');
              }}
            >
              <button className="secondary-btn" type="submit">
                Sign in with GitHub
              </button>
            </form>
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
  const rows = await db
    .select()
    .from(childrenTable)
    .where(and(eq(childrenTable.familyId, familySession.familyId), eq(childrenTable.isArchived, false)))
    .orderBy(childrenTable.createdAt);

  const [family] = await db
    .select({ nation: familiesTable.nation })
    .from(familiesTable)
    .where(eq(familiesTable.id, familySession.familyId));

  return (
    <main className="container">
      <h1>Children</h1>

      {family?.nation ? (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          {getNationContent(family.nation).legalStandard} Full details on each child&apos;s evidence report.
        </p>
      ) : (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          <Link href="/family">Set your nation</Link> to see the right home-education legal information for
          where you live — England, Wales, Scotland and Northern Ireland all differ.
        </p>
      )}

      {rows.length === 0 && (
        <p style={{ color: 'var(--text-muted)' }}>
          Add your first child&apos;s profile to start logging subjects and evidence.
        </p>
      )}

      {rows.map((child) => (
        <Link key={child.id} href={`/children/${child.id}`} className="card child-card">
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>{child.name}</h2>
          {child.yearGroup && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{child.yearGroup}</p>}
        </Link>
      ))}

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Add a child</h2>
        <AddChildForm />
      </section>
    </main>
  );
}
