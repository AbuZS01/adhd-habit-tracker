'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AddChildForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [yearGroup, setYearGroup] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch('/api/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          dateOfBirth: dateOfBirth || undefined,
          yearGroup: yearGroup || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not add child. Please try again.');
        return;
      }

      setName('');
      setDateOfBirth('');
      setYearGroup('');
      router.refresh();
    });
  }

  return (
    <form className="stacked" onSubmit={handleSubmit}>
      <label>
        Child&apos;s name
        <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} />
      </label>
      <label>
        Date of birth (optional)
        <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
      </label>
      <label>
        Year group / key stage (optional)
        <input value={yearGroup} onChange={(e) => setYearGroup(e.target.value)} maxLength={40} placeholder="e.g. Year 4" />
      </label>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-btn" type="submit" disabled={isPending}>
        {isPending ? 'Adding…' : 'Add child'}
      </button>
    </form>
  );
}
