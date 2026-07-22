'use client';

import { useEffect, useState } from 'react';
import AddChildForm from './AddChildForm';

export default function AddChildDrawer() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  return (
    <>
      <button className="add-btn" type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">+</span> Add child
      </button>

      <div className={`scrim${open ? ' open' : ''}`} onClick={() => setOpen(false)} />
      <aside className={`drawer${open ? ' open' : ''}`} aria-hidden={!open}>
        <div className="drawer-head">
          <h2 style={{ margin: 0, fontSize: '1.05rem' }}>Add a child</h2>
          <button className="drawer-close" type="button" aria-label="Close" onClick={() => setOpen(false)}>
            ✕
          </button>
        </div>
        <div className="drawer-body">
          <AddChildForm onSuccess={() => setOpen(false)} />
          <p className="drawer-note">
            You&apos;ll get four starting subjects — English, Maths, Science, Wider Learning — which you can
            rename or add to any time from the child&apos;s page.
          </p>
        </div>
      </aside>
    </>
  );
}
