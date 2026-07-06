import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { auth, signIn } from '@/lib/auth';
import { getDb } from '@/db/client';
import { habits, checkins, users } from '@/db/schema';
import { computeStreak } from '@/lib/streak';
import CheckInButton from '@/components/CheckInButton';
import StreakBadge from '@/components/StreakBadge';
import InstallPrompt from '@/components/InstallPrompt';
import { getPublicEnv } from '@/lib/env';

export default async function TodayPage() {
  const session = await auth();

  if (!session?.user?.id) {
    return (
      <main className="container">
        <h1>ADHD Habit Tracker</h1>
        <p>Sign in to see today&apos;s habits.</p>
        <form
          action={async () => {
            'use server';
            await signIn('github');
          }}
        >
          <button className="primary-btn" type="submit">
            Sign in with GitHub
          </button>
        </form>
      </main>
    );
  }

  const userId = session.user.id;
  const db = getDb();

  const [userRow] = await db.select({ timezone: users.timezone }).from(users).where(eq(users.id, userId));
  const timeZone = userRow?.timezone ?? 'UTC';

  const userHabits = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.isArchived, false)));

  if (userHabits.length === 0) {
    redirect('/onboarding');
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const habitCards = await Promise.all(
    userHabits.map(async (habit) => {
      const allCheckins = await db
        .select({ checkedAt: checkins.checkedAt })
        .from(checkins)
        .where(and(eq(checkins.habitId, habit.id), eq(checkins.userId, userId)));

      const streak = computeStreak(
        allCheckins.map((c) => c.checkedAt),
        timeZone
      );

      const checkedToday = allCheckins.some((c) => c.checkedAt >= todayStart);

      return { habit, streak, checkedToday };
    })
  );

  const { NEXT_PUBLIC_VAPID_PUBLIC_KEY } = getPublicEnv();

  return (
    <main className="container">
      <h1>Today</h1>
      {habitCards.map(({ habit, streak, checkedToday }) => (
        <section className="card" key={habit.id} aria-label={habit.name}>
          <h2 style={{ margin: '0 0 0.25rem', fontSize: '1.05rem' }}>{habit.name}</h2>
          {habit.cue && (
            <p style={{ margin: '0 0 0.5rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{habit.cue}</p>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
            <StreakBadge currentStreak={streak.currentStreak} longestStreak={streak.longestStreak} />
            <CheckInButton habitId={habit.id} initiallyCheckedToday={checkedToday} />
          </div>
        </section>
      ))}
      <InstallPrompt vapidPublicKey={NEXT_PUBLIC_VAPID_PUBLIC_KEY} />
    </main>
  );
}
