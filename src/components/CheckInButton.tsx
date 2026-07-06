'use client';

import { useState, useTransition } from 'react';

export interface CheckInButtonProps {
  habitId: string;
  initiallyCheckedToday: boolean;
  onCheckedIn?: (streak: { currentStreak: number; longestStreak: number }) => void;
}

/**
 * One-tap check-in (PLAN.md section 5). Only sends `habitId` — the server
 * verifies ownership and computes the streak; no streak math is trusted
 * from the client (SR-4).
 */
export default function CheckInButton({ habitId, initiallyCheckedToday, onCheckedIn }: CheckInButtonProps) {
  const [checked, setChecked] = useState(initiallyCheckedToday);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (checked || isPending) return;
    setError(null);

    startTransition(async () => {
      try {
        const res = await fetch('/api/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ habitId }),
        });

        if (res.status === 429) {
          setError("You're going fast — try again in a moment.");
          return;
        }
        if (!res.ok) {
          setError('Could not check in. Try again.');
          return;
        }

        const data = await res.json();
        setChecked(true);
        onCheckedIn?.(data.streak);
      } catch {
        setError('Network error. Try again.');
      }
    });
  }

  return (
    <div>
      <button
        type="button"
        className="check-in-button"
        data-checked={checked}
        onClick={handleClick}
        disabled={checked || isPending}
        aria-pressed={checked}
      >
        {checked ? 'Done today ✓' : isPending ? 'Checking in…' : 'Check in'}
      </button>
      {error && (
        <p role="alert" style={{ color: '#f87171', fontSize: '0.85rem', marginTop: '0.4rem' }}>
          {error}
        </p>
      )}
    </div>
  );
}
