import { auth, signIn } from '@/lib/auth';
import { lookupValidInvite } from '@/lib/family';
import AcceptInviteButton from '@/components/AcceptInviteButton';

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await auth();
  const invite = await lookupValidInvite(code);

  if (!invite) {
    return (
      <main className="container">
        <h1>Invite link invalid</h1>
        <p>This invite link has expired or already been used. Ask the family owner to send a new one.</p>
      </main>
    );
  }

  if (!session?.user) {
    return (
      <main className="container">
        <h1>Join {invite.familyName}</h1>
        <p>Sign in to accept this invite.</p>

        <section className="card">
          {process.env.EMAIL_SERVER && process.env.EMAIL_FROM && (
            <form
              className="stacked"
              action={async (formData: FormData) => {
                'use server';
                await signIn('nodemailer', formData);
              }}
            >
              <input type="hidden" name="redirectTo" value={`/invite/${code}`} />
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
                await signIn('github', { redirectTo: `/invite/${code}` });
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

  return (
    <main className="container">
      <h1>Join {invite.familyName}</h1>
      <p style={{ color: 'var(--color-neutral-700)' }}>
        You&apos;ll become a guardian of this family, with full access to every child&apos;s profile, subjects,
        and log entries.
      </p>
      <AcceptInviteButton code={code} />
    </main>
  );
}
