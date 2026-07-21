'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { NATION_LABELS, type Nation } from '@/lib/legal-content';

export interface FamilyMemberData {
  userId: string;
  role: 'owner' | 'guardian';
  name: string | null;
  email: string;
}

const NATION_OPTIONS = Object.entries(NATION_LABELS) as [Nation, string][];

export default function FamilyManager({
  familyName,
  nation,
  isOwner,
  members,
}: {
  familyName: string;
  nation: Nation | null;
  isOwner: boolean;
  members: FamilyMemberData[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(familyName);
  const [renameMessage, setRenameMessage] = useState<string | null>(null);
  const [selectedNation, setSelectedNation] = useState<string>(nation ?? '');
  const [nationMessage, setNationMessage] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);

  function saveRename(e: React.FormEvent) {
    e.preventDefault();
    setRenameMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/family', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setRenameMessage('Saved.');
        router.refresh();
      } else {
        setRenameMessage('Could not save.');
      }
    });
  }

  function saveNation(e: React.FormEvent) {
    e.preventDefault();
    setNationMessage(null);
    startTransition(async () => {
      const res = await fetch('/api/family', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nation: selectedNation || null }),
      });
      if (res.ok) {
        setNationMessage('Saved.');
        router.refresh();
      } else {
        setNationMessage('Could not save.');
      }
    });
  }

  function createInvite() {
    setInviteError(null);
    setInviteLink(null);
    startTransition(async () => {
      const res = await fetch('/api/family/invite', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setInviteError(body?.error ?? 'Could not create invite.');
        return;
      }
      const body = await res.json();
      setInviteLink(`${window.location.origin}/invite/${body.code}`);
    });
  }

  function removeMember(userId: string) {
    startTransition(async () => {
      const res = await fetch(`/api/family/members/${userId}`, { method: 'DELETE' });
      if (res.ok) router.refresh();
    });
  }

  return (
    <>
      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Family name</h2>
        {isOwner ? (
          <form className="form-row" onSubmit={saveRename}>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required />
            <button className="secondary-btn" type="submit" disabled={isPending}>
              Save
            </button>
          </form>
        ) : (
          <p>{familyName}</p>
        )}
        {renameMessage && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{renameMessage}</p>}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Nation</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Home education law differs across the UK — setting this shows the right legal information on your
          dashboard and evidence reports.
        </p>
        {isOwner ? (
          <form className="form-row" onSubmit={saveNation}>
            <select value={selectedNation} onChange={(e) => setSelectedNation(e.target.value)}>
              <option value="">Not set</option>
              {NATION_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <button className="secondary-btn" type="submit" disabled={isPending}>
              Save
            </button>
          </form>
        ) : (
          <p>{nation ? NATION_LABELS[nation] : 'Not set'}</p>
        )}
        {nationMessage && <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{nationMessage}</p>}
      </section>

      <section className="card">
        <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Guardians</h2>
        <ul className="subject-list">
          {members.map((m) => (
            <li key={m.userId} className="subject-row">
              <span style={{ flex: 1 }}>
                {m.name ?? m.email} <span style={{ color: 'var(--text-muted)' }}>({m.role})</span>
              </span>
              {isOwner && m.role !== 'owner' && (
                <button className="link-btn" onClick={() => removeMember(m.userId)} disabled={isPending}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      {isOwner && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Invite a co-guardian</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Generate a one-time link valid for 7 days. Anyone with the link can join this family and see all
            children&apos;s records — only share it with people you trust.
          </p>
          <button className="secondary-btn" onClick={createInvite} disabled={isPending}>
            Generate invite link
          </button>
          {inviteLink && (
            <p style={{ wordBreak: 'break-all', marginTop: '0.5rem' }}>
              <code>{inviteLink}</code>
            </p>
          )}
          {inviteError && <p className="form-error">{inviteError}</p>}
        </section>
      )}
    </>
  );
}
