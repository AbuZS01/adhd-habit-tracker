'use client';

import { useState, type ReactNode } from 'react';
import { Plus } from 'lucide-react';
import AddChildForm from './AddChildForm';

export default function DashboardHeader({ sub }: { sub: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 style={{ marginBottom: '0.25rem', fontWeight: 400 }}>Children</h1>
          {sub}
        </div>
        <button className="btn btn-icon btn-ghost" type="button" onClick={() => setOpen((v) => !v)} aria-label="Add a child">
          <Plus size={20} strokeWidth={2} aria-hidden="true" />
        </button>
      </div>

      {open && (
        <section className="card">
          <h2 style={{ marginTop: 0, fontSize: '1.05rem' }}>Add a child</h2>
          <AddChildForm onSuccess={() => setOpen(false)} />
          <button className="link-btn" style={{ marginTop: '0.6rem' }} onClick={() => setOpen(false)}>
            Cancel
          </button>
        </section>
      )}
    </>
  );
}
