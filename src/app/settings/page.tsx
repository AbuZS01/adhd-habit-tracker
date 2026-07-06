'use client';

import { useEffect, useState } from 'react';

export default function SettingsPage() {
  const [timezone, setTimezone] = useState('UTC');
  const [quietStart, setQuietStart] = useState(22);
  const [quietEnd, setQuietEnd] = useState(8);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Default to the browser's detected timezone the first time settings load.
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data.settings) {
          setTimezone(data.settings.timezone || detected);
          setQuietStart(data.settings.quietHoursStart);
          setQuietEnd(data.settings.quietHoursEnd);
        } else if (detected) {
          setTimezone(detected);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    const res = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timezone, quietHoursStart: quietStart, quietHoursEnd: quietEnd }),
    });
    if (res.status === 429) {
      setError("You're going fast — try again shortly.");
      return;
    }
    if (!res.ok) {
      setError('Could not save settings.');
      return;
    }
    setSaved(true);
  }

  if (loading) {
    return (
      <main className="container">
        <p>Loading…</p>
      </main>
    );
  }

  return (
    <main className="container">
      <h1>Settings</h1>
      <form className="stacked" onSubmit={handleSave}>
        <label>
          Timezone
          <input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="e.g. America/New_York" />
        </label>
        <label>
          Quiet hours start
          <select value={quietStart} onChange={(e) => setQuietStart(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
        <label>
          Quiet hours end
          <select value={quietEnd} onChange={(e) => setQuietEnd(Number(e.target.value))}>
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
        </label>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          No reminders will be sent during quiet hours.
        </p>
        {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
        {saved && <p style={{ color: 'var(--success)' }}>Saved.</p>}
        <button className="primary-btn" type="submit">
          Save
        </button>
      </form>
    </main>
  );
}
