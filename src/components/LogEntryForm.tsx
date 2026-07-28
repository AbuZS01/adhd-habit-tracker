'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { EvidenceButtons, uploadAttachment, type EvidenceKind } from './AttachmentUploader';
import {
  createSpeechRecognition,
  extractFinalTranscript,
  isSpeechRecognitionSupported,
  type SpeechRecognitionInstance,
} from '@/lib/speechRecognition';

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

function SoundwaveIcon({ active }: { active: boolean }) {
  return (
    <span className={`soundwave-icon${active ? ' active' : ''}`} aria-hidden="true">
      <span className="soundwave-bar" />
      <span className="soundwave-bar" />
      <span className="soundwave-bar" />
      <span className="soundwave-bar" />
    </span>
  );
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
  const [stagedFile, setStagedFile] = useState<{ file: File; kind: EvidenceKind } | null>(null);
  const [speechSupported, setSpeechSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  useEffect(() => {
    setSpeechSupported(isSpeechRecognitionSupported());
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  function toggleDictation() {
    if (isListening) {
      recognitionRef.current?.stop();
      return;
    }

    const recognition = createSpeechRecognition();
    if (!recognition) return;

    recognition.onresult = (event) => {
      const finalText = extractFinalTranscript(event);
      if (!finalText) return;
      setDescription((prev) => (prev ? `${prev} ${finalText}` : finalText));
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }

  function resetForm() {
    setTitle('');
    setDescription('');
    setExternalLink('');
    setSubjectId('');
    setActivityType('note');
    setEntryDate(today());
    setStagedFile(null);
  }

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

      const { entry } = await res.json();

      if (stagedFile) {
        const result = await uploadAttachment(stagedFile.file, entry.id, stagedFile.kind);
        if (!result.ok) {
          setError(`Entry saved, but the ${stagedFile.kind} failed to upload: ${result.error}`);
          resetForm();
          router.refresh();
          return;
        }
      }

      resetForm();
      router.refresh();
    });
  }

  return (
    <form className="stacked" onSubmit={handleSubmit}>
      {uploadsEnabled && (
        <div>
          <EvidenceButtons onFileSelected={(file, kind) => setStagedFile({ file, kind })} disabled={isPending} />
          {stagedFile && <p className="form-photo-selected">{stagedFile.file.name} selected</p>}
        </div>
      )}
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
      <div className="notes-field">
        <span className="label-row">
          <label htmlFor="entry-notes">Notes (optional)</label>
          {speechSupported && (
            <button
              type="button"
              className={`mic-btn${isListening ? ' listening' : ''}`}
              onClick={toggleDictation}
              aria-pressed={isListening}
            >
              <SoundwaveIcon active={isListening} />
              {isListening ? 'Listening… (tap to stop)' : 'Dictate'}
            </button>
          )}
        </span>
        <textarea
          id="entry-notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
          rows={2}
        />
      </div>
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
