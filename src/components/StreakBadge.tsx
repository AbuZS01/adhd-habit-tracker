'use client';

/**
 * Forgiving streak display: "days shown up", never a punitive red counter.
 * Missed days are visually neutral (SR-2: only ever renders plain numbers/
 * text through normal JSX interpolation — no dangerouslySetInnerHTML).
 */
export interface StreakBadgeProps {
  currentStreak: number;
  longestStreak: number;
}

export default function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
  const label = currentStreak === 1 ? 'day' : 'days';

  return (
    <span className="streak-badge" aria-label={`${currentStreak} ${label} shown up in a row`}>
      <span className="dot-hit" aria-hidden="true">
        {'●'.repeat(Math.min(currentStreak, 5))}
      </span>
      <span>
        {currentStreak} {label}
        {longestStreak > currentStreak ? ` · best ${longestStreak}` : ''}
      </span>
    </span>
  );
}
