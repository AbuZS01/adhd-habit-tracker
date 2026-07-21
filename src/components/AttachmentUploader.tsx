'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { upload } from '@vercel/blob/client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
const MAX_BYTES = 15 * 1024 * 1024;

function sanitizeFilename(name: string): string {
  const base = name.trim().slice(-180).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'file';
}

export default function AttachmentUploader({ logEntryId }: { logEntryId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file again later
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Only JPEG/PNG/WebP/HEIC photos or PDFs are supported.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('File is too large (max 15MB).');
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const pathname = `entries/${logEntryId}/${sanitizeFilename(file.name)}`;
        const blob = await upload(pathname, file, {
          access: 'private',
          handleUploadUrl: '/api/attachments/upload',
          clientPayload: JSON.stringify({ logEntryId }),
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
          setError(resBody?.error ?? 'Could not save the upload.');
          return;
        }

        router.refresh();
      } catch {
        setError('Upload failed. Please try again.');
      }
    });
  }

  return (
    <div className="attachment-uploader no-print">
      <label className="link-btn">
        {isPending ? 'Uploading…' : '+ Add photo'}
        <input
          type="file"
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleChange}
          disabled={isPending}
          style={{ display: 'none' }}
        />
      </label>
      {error && <p className="form-error">{error}</p>}
    </div>
  );
}
