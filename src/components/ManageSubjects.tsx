'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';

export interface SubjectData {
  id: string;
  name: string;
}

function SubjectTag({ subject, otherNames }: { subject: SubjectData; otherNames: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);
  const [error, setError] = useState<string | null>(null);

  function saveRename() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === subject.name) {
      setEditing(false);
      setName(subject.name);
      return;
    }
    if (otherNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) {
      setError('That subject already exists.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not rename.');
      }
    });
  }

  function archive() {
    startTransition(async () => {
      const res = await fetch(`/api/subjects/${subject.id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    });
  }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: '0.2rem' }}>
        <span className="subject-tag">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') saveRename();
              if (e.key === 'Escape') {
                setName(subject.name);
                setEditing(false);
                setError(null);
              }
            }}
            maxLength={60}
            autoFocus
            disabled={isPending}
            style={{ border: 'none', background: 'transparent', padding: 0, font: 'inherit', color: 'inherit', width: `${Math.max(name.length, 4)}ch` }}
          />
        </span>
        {error && <span className="form-error" style={{ fontSize: '0.7rem' }}>{error}</span>}
      </span>
    );
  }

  return (
    <span className="subject-tag">
      <button type="button" onClick={() => setEditing(true)} style={{ appearance: 'none', border: 'none', background: 'none', padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer' }}>
        {subject.name}
      </button>
      <button type="button" onClick={archive} disabled={isPending} aria-label={`Archive ${subject.name}`}>
        <X size={12} strokeWidth={2.5} />
      </button>
    </span>
  );
}

export default function ManageSubjects({ childId, subjects }: { childId: string; subjects: SubjectData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  function addSubject(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (subjects.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('That subject already exists.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(`/api/children/${childId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        setNewName('');
        router.refresh();
      } else {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not add subject.');
      }
    });
  }

  if (!open) {
    return (
      <button className="link-btn no-print" onClick={() => setOpen(true)}>
        Manage subjects
      </button>
    );
  }

  return (
    <section className="card no-print">
      <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Manage subjects</h2>
      <div className="subject-tag-list">
        {subjects.map((s) => (
          <SubjectTag
            key={s.id}
            subject={s}
            otherNames={subjects.filter((o) => o.id !== s.id).map((o) => o.name)}
          />
        ))}
      </div>
      <form className="form-row" onSubmit={addSubject}>
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setError(null);
          }}
          placeholder="e.g. Quran, Hadith"
          maxLength={60}
          required
        />
        <button className="btn btn-secondary" type="submit" disabled={isPending}>
          Add
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      <button className="link-btn" style={{ marginTop: '0.6rem' }} onClick={() => setOpen(false)}>
        Close
      </button>
    </section>
  );
}
