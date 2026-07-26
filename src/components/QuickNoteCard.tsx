'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface ChildOption {
  id: string;
  name: string;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function QuickNoteCard({ childOptions }: { childOptions: ChildOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [childId, setChildId] = useState(childOptions[0]?.id ?? '');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    startTransition(async () => {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          subjectId: null,
          entryDate: today(),
          title: note,
          activityType: 'note',
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not save the note. Please try again.');
        return;
      }

      setNote('');
      setSaved(true);
      router.refresh();
    });
  }

  return (
    <section className="card quick-note no-print">
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Quick note</h2>
      <form className="form-row" onSubmit={handleSubmit}>
        <select value={childId} onChange={(e) => setChildId(e.target.value)} aria-label="Child" style={{ flex: '0 0 160px' }}>
          {childOptions.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            setSaved(false);
          }}
          placeholder="e.g. Practised spellings in the car"
          maxLength={140}
          required
          style={{ flex: 1 }}
        />
        <button className="secondary-btn" type="submit" disabled={isPending || !childId}>
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {saved && <p className="b-sub">Saved.</p>}
    </section>
  );
}
