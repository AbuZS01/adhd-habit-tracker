/**
 * Shared "how fresh is this child's record" logic for the dashboard cards.
 * A single tiering rule feeds both the ring's fill percentage/colour and
 * the plain-text label, so the two never drift out of sync.
 */

export type RecencyTier = 'good' | 'warn' | 'stale' | 'none';

export interface Recency {
  tier: RecencyTier;
  /** Ring fill, 0-100. */
  ringPercent: number;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function computeRecency(lastEntryDate: string | null, now: Date = new Date()): Recency {
  if (!lastEntryDate) {
    return { tier: 'none', ringPercent: 0, label: 'No entries yet' };
  }

  const last = new Date(`${lastEntryDate}T00:00:00Z`);
  const days = Math.max(0, Math.floor((now.getTime() - last.getTime()) / DAY_MS));

  if (days <= 7) {
    return { tier: 'good', ringPercent: 100, label: days === 0 ? 'Logged today' : `Last logged ${days} day${days === 1 ? '' : 's'} ago` };
  }
  if (days <= 28) {
    const weeks = Math.round(days / 7);
    return { tier: 'warn', ringPercent: 50, label: `Last logged ${weeks} week${weeks === 1 ? '' : 's'} ago` };
  }
  return { tier: 'stale', ringPercent: 15, label: `Last logged over a month ago` };
}
