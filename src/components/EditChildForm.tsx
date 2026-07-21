'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface ChildData {
  id: string;
  name: string;
  dateOfBirth: string | null;
  yearGroup: string | null;
  notes: string | null;
}

export default function EditChildForm({ child }: { child: ChildData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(child.name);
  const [dateOfBirth, setDateOfBirth] = useState(child.dateOfBirth ?? '');
  const [yearGroup, setYearGroup] = useState(child.yearGroup ?? '');
  const [notes, setNotes] = useState(child.notes ?? '');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/children/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dateOfBirth: dateOfBirth || null,
          yearGroup: yearGroup || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not save changes.');
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button className="link-btn no-print" onClick={() => setOpen(true)}>
        Edit details
      </button>
    );
  }

  return (
    <form className="stacked no-print" onSubmit={handleSubmit} style={{ marginTop: '0.5rem' }}>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Date of birth
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </label>
      <label>
        Year group / key stage
        <input value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} maxLength={40} />
      </label>
      <label>
        Notes
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={1000} rows={2} />
      </label>
      {error && <p className="form-error">{error}</p>}
      <div className="form-row">
        <button className="primary-btn" type="submit" disabled={isPending}>
          Save
        </button>
        <button className="secondary-btn" type="button" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}
