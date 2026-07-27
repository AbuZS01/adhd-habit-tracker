'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

interface SubjectOption {
  id: string;
  name: string;
}

interface PlannedItem {
  id: string;
  subjectId: string | null;
  title: string | null;
  completed: boolean;
  subjectName: string | null;
}

function formatDayHeading(date: string, label: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const formatted = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
  return `${label}, ${formatted}`;
}

export default function PlannerDay({
  childId,
  date,
  label,
  subjects,
  items,
}: {
  childId: string;
  date: string;
  label: string;
  subjects: SubjectOption[];
  items: PlannedItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  function addPlannedActivity(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/planned-activities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          subjectId: subjectId || null,
          plannedDate: date,
          title: title || undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not add plan.');
        return;
      }
      setSubjectId('');
      setTitle('');
      router.refresh();
    });
  }

  function removePlannedActivity(id: string) {
    startTransition(async () => {
      const res = await fetch(`/api/planned-activities/${id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <section className="card planner-day" id={`day-${date}`} style={{ scrollMarginTop: '1rem' }}>
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>{formatDayHeading(date, label)}</h2>

      {items.length === 0 ? (
        <p className="b-sub">Nothing planned yet.</p>
      ) : (
        <ul className="planner-item-list">
          {items.map((item) => (
            <li key={item.id} className="planner-item">
              <span className={`planner-status ${item.completed ? 'done' : 'pending'}`}>
                {item.completed ? '✓' : '○'}
              </span>
              <span className="planner-item-text">
                {item.subjectName && <strong>{item.subjectName}</strong>}
                {item.subjectName && item.title && ' — '}
                {item.title}
                {!item.subjectName && !item.title && 'General'}
              </span>
              <span className={`planner-item-badge ${item.completed ? 'done' : 'pending'}`}>
                {item.completed ? 'Completed' : 'Not started'}
              </span>
              <button className="link-btn no-print" onClick={() => removePlannedActivity(item.id)} disabled={isPending}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <form className="form-row planner-add-form no-print" onSubmit={addPlannedActivity}>
        <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} aria-label="Subject">
          <option value="">General / cross-curricular</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note (optional)"
          maxLength={140}
          aria-label="Plan note"
        />
        <button className="secondary-btn" type="submit" disabled={isPending}>
          Add to plan
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
