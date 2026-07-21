'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export interface SubjectData {
  id: string;
  name: string;
}

function SubjectRow({ subject }: { subject: SubjectData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(subject.name);

  function saveRename() {
    startTransition(async () => {
      const res = await fetch(`/api/subjects/${subject.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setEditing(false);
        router.refresh();
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
      <li className="subject-row">
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} style={{ flex: 1 }} />
        <button className="link-btn" onClick={saveRename} disabled={isPending}>
          Save
        </button>
        <button className="link-btn" onClick={() => setEditing(false)} disabled={isPending}>
          Cancel
        </button>
      </li>
    );
  }

  return (
    <li className="subject-row">
      <span style={{ flex: 1 }}>{subject.name}</span>
      <button className="link-btn" onClick={() => setEditing(true)}>
        Rename
      </button>
      <button className="link-btn" onClick={archive} disabled={isPending}>
        Archive
      </button>
    </li>
  );
}

export default function ManageSubjects({ childId, subjects }: { childId: string; subjects: SubjectData[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [newName, setNewName] = useState('');
  const [open, setOpen] = useState(false);

  function addSubject(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const res = await fetch(`/api/children/${childId}/subjects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName }),
      });
      if (res.ok) {
        setNewName('');
        router.refresh();
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
      <ul className="subject-list">
        {subjects.map((s) => (
          <SubjectRow key={s.id} subject={s} />
        ))}
      </ul>
      <form className="form-row" onSubmit={addSubject} style={{ marginTop: '0.75rem' }}>
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="New subject name"
          maxLength={60}
          required
        />
        <button className="secondary-btn" type="submit" disabled={isPending}>
          Add
        </button>
      </form>
      <button className="link-btn" onClick={() => setOpen(false)} style={{ marginTop: '0.5rem' }}>
        Close
      </button>
    </section>
  );
}
