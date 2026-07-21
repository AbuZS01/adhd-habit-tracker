'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

export default function AcceptInviteButton({ code }: { code: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await fetch('/api/family/invite/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? 'Could not join this family.');
        return;
      }
      router.push('/');
      router.refresh();
    });
  }

  return (
    <>
      <button className="primary-btn" onClick={accept} disabled={isPending}>
        {isPending ? 'Joining…' : 'Join family'}
      </button>
      {error && <p className="form-error">{error}</p>}
    </>
  );
}
