'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import AttachmentUploader from './AttachmentUploader';

export interface LogEntryData {
  id: string;
  entryDate: string;
  title: string;
  description: string | null;
  activityType: string;
  externalLink: string | null;
}

export interface AttachmentData {
  id: string;
  originalName: string;
  contentType: string;
}

const ACTIVITY_LABELS: Record<string, string> = {
  note: 'Note',
  work_sample: 'Work sample',
  outing: 'Outing / trip',
  resource: 'Resource used',
  assessment: 'Assessment',
  other: 'Other',
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function AttachmentThumb({ attachment }: { attachment: AttachmentData }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const fileUrl = `/api/attachments/${attachment.id}/file`;

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/attachments/${attachment.id}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <div className="attachment-thumb-wrap">
      <a href={fileUrl} target="_blank" rel="noopener noreferrer">
        {attachment.contentType.startsWith('image/') ? (
          <img src={fileUrl} alt={attachment.originalName} className="attachment-thumb" loading="lazy" />
        ) : (
          <span className="attachment-file-link">📄 {attachment.originalName}</span>
        )}
      </a>
      <button className="link-btn no-print attachment-remove" onClick={handleDelete} disabled={isPending}>
        Remove
      </button>
    </div>
  );
}

export default function LogEntryItem({
  entry,
  attachments,
  uploadsEnabled,
}: {
  entry: LogEntryData;
  attachments: AttachmentData[];
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  function handleDelete() {
    startTransition(async () => {
      const res = await fetch(`/api/entries/${entry.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
      setConfirming(false);
    });
  }

  return (
    <li className="entry-item">
      <div className="entry-item-header">
        <span className="entry-date">{formatDate(entry.entryDate)}</span>
        <span className="entry-type-badge">{ACTIVITY_LABELS[entry.activityType] ?? entry.activityType}</span>
      </div>
      <p className="entry-title">{entry.title}</p>
      {entry.description && <p className="entry-description">{entry.description}</p>}
      {entry.externalLink && (
        <a href={entry.externalLink} target="_blank" rel="noopener noreferrer nofollow" className="entry-link">
          View evidence ↗
        </a>
      )}
      {attachments.length > 0 && (
        <div className="attachment-grid">
          {attachments.map((a) => (
            <AttachmentThumb key={a.id} attachment={a} />
          ))}
        </div>
      )}
      {uploadsEnabled && <AttachmentUploader logEntryId={entry.id} />}
      <div className="no-print">
        {confirming ? (
          <span className="entry-actions">
            Delete this entry?{' '}
            <button className="link-btn" onClick={handleDelete} disabled={isPending}>
              Yes
            </button>{' '}
            <button className="link-btn" onClick={() => setConfirming(false)} disabled={isPending}>
              Cancel
            </button>
          </span>
        ) : (
          <button className="link-btn" onClick={() => setConfirming(true)}>
            Delete
          </button>
        )}
      </div>
    </li>
  );
}
