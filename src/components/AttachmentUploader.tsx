'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';

export type EvidenceKind = 'photo' | 'video' | 'file';

export const ATTACHMENT_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'];
export const ATTACHMENT_VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
export const ATTACHMENT_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
];

export const ATTACHMENT_ALLOWED_TYPES = [...ATTACHMENT_PHOTO_TYPES, ...ATTACHMENT_VIDEO_TYPES, ...ATTACHMENT_FILE_TYPES];

export const ATTACHMENT_MAX_BYTES = 15 * 1024 * 1024; // 15MB — photos and documents.
export const ATTACHMENT_MAX_VIDEO_BYTES = 200 * 1024 * 1024; // 200MB — phone video clips are much larger.

const KIND_CONFIG: Record<EvidenceKind, { types: string[]; maxBytes: number; icon: string; label: string; errorLabel: string }> = {
  photo: { types: ATTACHMENT_PHOTO_TYPES, maxBytes: ATTACHMENT_MAX_BYTES, icon: '📷', label: 'Photo', errorLabel: 'JPEG/PNG/WebP/HEIC photos' },
  video: { types: ATTACHMENT_VIDEO_TYPES, maxBytes: ATTACHMENT_MAX_VIDEO_BYTES, icon: '🎥', label: 'Video', errorLabel: 'MP4/MOV/WebM videos' },
  file: { types: ATTACHMENT_FILE_TYPES, maxBytes: ATTACHMENT_MAX_BYTES, icon: '📄', label: 'File', errorLabel: 'PDF, Word, Excel, or text files' },
};

function sanitizeFilename(name: string): string {
  const base = name.trim().slice(-180).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'file';
}

function maxBytesForBytes(kind: EvidenceKind): number {
  return KIND_CONFIG[kind].maxBytes;
}

function formatMaxSize(bytes: number): string {
  return bytes >= 1024 * 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024 * 1024))}GB` : `${Math.round(bytes / (1024 * 1024))}MB`;
}

export function validateAttachmentFile(file: File, kind: EvidenceKind): string | null {
  const config = KIND_CONFIG[kind];
  if (!config.types.includes(file.type)) {
    return `Only ${config.errorLabel} are supported for ${config.label.toLowerCase()}.`;
  }
  if (file.size > config.maxBytes) {
    return `File is too large (max ${formatMaxSize(maxBytesForBytes(kind))}).`;
  }
  return null;
}

export async function uploadAttachment(
  file: File,
  logEntryId: string,
  kind: EvidenceKind,
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const pathname = `entries/${logEntryId}/${sanitizeFilename(file.name)}`;
    const blob = await upload(pathname, file, {
      access: 'private',
      handleUploadUrl: '/api/attachments/upload',
      clientPayload: JSON.stringify({ logEntryId, kind }),
    });

    const res = await fetch(`/api/entries/${logEntryId}/attachments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathname: blob.pathname,
        originalName: file.name,
        contentType: blob.contentType ?? file.type,
        size: file.size,
      }),
    });

    if (!res.ok) {
      const resBody = await res.json().catch(() => null);
      return { ok: false, error: resBody?.error ?? 'Could not save the upload.' };
    }
    return { ok: true };
  } catch {
    return { ok: false, error: 'Upload failed. Please try again.' };
  }
}

const EVIDENCE_KINDS: EvidenceKind[] = ['photo', 'video', 'file'];

/**
 * Three icon buttons (Photo / Video / File), each opening a file picker
 * scoped to its own accepted types. Purely presentational — the caller
 * decides what happens once a valid file is picked (upload immediately,
 * or stage it for later, per `onFileSelected`).
 */
export function EvidenceButtons({
  onFileSelected,
  disabled,
}: {
  onFileSelected: (file: File, kind: EvidenceKind) => void;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>, kind: EvidenceKind) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    const validationError = validateAttachmentFile(file, kind);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    onFileSelected(file, kind);
  }

  return (
    <div className="evidence-buttons-wrap">
      <div className="evidence-btn-row">
        {EVIDENCE_KINDS.map((kind) => {
          const config = KIND_CONFIG[kind];
          return (
            <label key={kind} className="evidence-btn">
              <span className="evidence-btn-icon" aria-hidden="true">
                {config.icon}
              </span>
              <span className="evidence-btn-label">{config.label}</span>
              <input
                type="file"
                accept={config.types.join(',')}
                onChange={(e) => handleChange(e, kind)}
                disabled={disabled}
                style={{ display: 'none' }}
              />
            </label>
          );
        })}
      </div>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}

export default function AttachmentUploader({ logEntryId, hasAttachments }: { logEntryId: string; hasAttachments: boolean }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Once an entry already has evidence, don't show the three buttons by
  // default — they read as duplicated UI sitting right under a photo you
  // just added. Tapping "+ Add more evidence" brings them back.
  const [expanded, setExpanded] = useState(!hasAttachments);

  function handleFileSelected(file: File, kind: EvidenceKind) {
    setUploadError(null);
    startTransition(async () => {
      const result = await uploadAttachment(file, logEntryId, kind);
      if (!result.ok) {
        setUploadError(result.error);
        return;
      }
      setExpanded(false);
      router.refresh();
    });
  }

  return (
    <div className="attachment-uploader no-print">
      {expanded ? (
        <EvidenceButtons onFileSelected={handleFileSelected} disabled={isPending} />
      ) : (
        <button type="button" className="link-btn" onClick={() => setExpanded(true)}>
          + Add more evidence
        </button>
      )}
      {isPending && <p className="b-sub">Uploading…</p>}
      {uploadError && <p className="form-error">{uploadError}</p>}
    </div>
  );
}
