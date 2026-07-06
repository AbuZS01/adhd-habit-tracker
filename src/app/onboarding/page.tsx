'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Onboarding: create 1-3 habits in under a minute with sensible defaults —
 * no long config wall (PLAN.md section 5). Each habit posts to the same
 * validated, user-scoped /api/habits endpoint as the main habits page.
 */
const SUGGESTIONS = [
  { name: 'Take meds', cue: 'After I pour coffee', scheduleTime: '08:00' },
  { name: 'Drink water', cue: 'After I sit at my desk', scheduleTime: '10:00' },
  { name: 'Evening wind-down', cue: 'After I brush my teeth', scheduleTime: '21:30' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<boolean[]>(SUGGESTIONS.map(() => false));
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(idx: number) {
    setSelected((prev) => prev.map((v, i) => (i === idx ? !v : v)));
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);

    const toCreate = SUGGESTIONS.filter((_, i) => selected[i]);
    if (customName.trim().length > 0) {
      toCreate.push({ name: customName.trim(), cue: '', scheduleTime: '09:00' });
    }

    if (toCreate.length === 0) {
      setError('Pick at least one habit, or add your own.');
      setSubmitting(false);
      return;
    }

    try {
      for (const habit of toCreate.slice(0, 3)) {
        const res = await fetch('/api/habits', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: habit.name,
            cue: habit.cue || undefined,
            scheduleTime: habit.scheduleTime,
            activeDays: [0, 1, 2, 3, 4, 5, 6],
          }),
        });
        if (!res.ok) {
          setError('Something went wrong creating a habit. Try again.');
          setSubmitting(false);
          return;
        }
      }
      router.push('/');
      router.refresh();
    } catch {
      setError('Network error. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1>Let&apos;s set up 1-3 habits</h1>
      <p style={{ color: 'var(--text-muted)' }}>Pick from these, or add your own. Takes under a minute.</p>

      <div className="stacked" style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1rem' }}>
        {SUGGESTIONS.map((s, i) => (
          <label key={s.name} className="card" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }}>
            <input type="checkbox" checked={selected[i]} onChange={() => toggle(i)} />
            <span>
              <strong>{s.name}</strong>
              <br />
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{s.cue}</span>
            </span>
          </label>
        ))}
      </div>

      <form
        className="stacked"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <label>
          Or add your own
          <input
            type="text"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            maxLength={80}
            placeholder="e.g. Stretch for 5 minutes"
          />
        </label>
        {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
        <button className="primary-btn" type="submit" disabled={submitting}>
          {submitting ? 'Setting up…' : 'Start tracking'}
        </button>
      </form>
    </main>
  );
}
