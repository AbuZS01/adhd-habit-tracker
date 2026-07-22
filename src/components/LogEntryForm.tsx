'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AttachmentUploader from './AttachmentUploader';

interface SubjectOption {
  id: string;
  name: string;
}

const ACTIVITY_TYPES: { value: string; label: string }[] = [
  { value: 'note', label: 'Note' },
  { value: 'work_sample', label: 'Work sample' },
  { value: 'outing', label: 'Outing / trip' },
  { value: 'resource', label: 'Resource used' },
  { value: 'assessment', label: 'Assessment' },
  { value: 'other', label: 'Other' },
];

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function LogEntryForm({
  childId,
  subjects,
  uploadsEnabled,
}: {
  childId: string;
  subjects: SubjectOption[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [entryDate, setEntryDate] = useState(today());
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [activityType, setActivityType] = useState('note');
  const [externalLink, setExternalLink] = useState('');
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          childId,
          subjectId: subjectId || null,
          entryDate,
          title,
          description: description || undefined,
          activityType,
          externalLink: externalLink || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not save entry. Please try again.');
        return;
      }

      router.refresh();

      if (uploadsEnabled) {
        const { entry } = await res.json();
        setSavedEntryId(entry.id);
      } else {
        finishEntry();
      }
    });
  }

  function finishEntry() {
    setSavedEntryId(null);
    setTitle('');
    setDescription('');
    setExternalLink('');
    setSubjectId('');
    setActivityType('note');
    setEntryDate(today());
    router.refresh();
  }

  if (savedEntryId) {
    return (
      <div className="stacked">
        <p className="form-saved-note">
          &quot;{title}&quot; saved. Attach a photo now, or come back to it later from the entry below.
        </p>
        <AttachmentUploader logEntryId={savedEntryId} />
        <button className="secondary-btn" type="button" onClick={finishEntry}>
          Done
        </button>
      </div>
    );
  }

  return (
    <form className="stacked" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Date
          <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} max={today()} required />
        </label>
        <label>
          Subject
          <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
            <option value="">General / cross-curricular</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label>
        Title
        <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={140} placeholder="e.g. Fractions worksheet" />
      </label>
      <label>
        Notes (optional)
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={4000} rows={2} />
      </label>
      <div className="form-row">
        <label>
          Type
          <select value={activityType} onChange={(e) => setActivityType(e.target.value)}>
            {ACTIVITY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Link to evidence (optional)
          <input
            type="url"
            value={externalLink}
            onChange={(e) => setExternalLink(e.target.value)}
            placeholder="https://…"
          />
        </label>
      </div>
      {error && <p className="form-error">{error}</p>}
      <button className="primary-btn" type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Add entry'}
      </button>
    </form>
  );
}
