'use client';

import { useEffect, useState } from 'react';

interface Habit {
  id: string;
  name: string;
  cue: string | null;
  note: string | null;
  scheduleTime: string;
  activeDays: number[];
}

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function HabitsPage() {
  const [habitList, setHabitList] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [newCue, setNewCue] = useState('');
  const [newTime, setNewTime] = useState('09:00');
  const [error, setError] = useState<string | null>(null);

  async function loadHabits() {
    setLoading(true);
    const res = await fetch('/api/habits');
    if (res.ok) {
      const data = await res.json();
      setHabitList(data.habits);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadHabits();
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch('/api/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newName,
        cue: newCue || undefined,
        scheduleTime: newTime,
        activeDays: [0, 1, 2, 3, 4, 5, 6],
      }),
    });
    if (res.status === 429) {
      setError("You're going fast — try again shortly.");
      return;
    }
    if (!res.ok) {
      setError('Could not create habit. Check the fields and try again.');
      return;
    }
    setNewName('');
    setNewCue('');
    setNewTime('09:00');
    loadHabits();
  }

  async function handleDelete(id: string) {
    const res = await fetch(`/api/habits/${id}`, { method: 'DELETE' });
    if (res.ok) loadHabits();
  }

  return (
    <main className="container">
      <h1>Habits</h1>

      {loading && <p>Loading…</p>}

      {!loading &&
        habitList.map((h) => (
          <div className="card" key={h.id}>
            <strong>{h.name}</strong>
            {h.cue && <p style={{ margin: '0.25rem 0', color: 'var(--text-muted)' }}>{h.cue}</p>}
            <p style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {h.scheduleTime} · {h.activeDays.map((d) => DAY_LABELS[d]).join(', ')}
            </p>
            <button className="secondary-btn" onClick={() => handleDelete(h.id)}>
              Remove
            </button>
          </div>
        ))}

      <h2>Add a habit</h2>
      <form className="stacked" onSubmit={handleCreate}>
        <label>
          Name
          <input value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} required />
        </label>
        <label>
          Cue (implementation intention), optional
          <input
            value={newCue}
            onChange={(e) => setNewCue(e.target.value)}
            maxLength={120}
            placeholder="After I ___"
          />
        </label>
        <label>
          Reminder time
          <input type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} required />
        </label>
        {error && <p role="alert" style={{ color: '#f87171' }}>{error}</p>}
        <button className="primary-btn" type="submit">
          Add habit
        </button>
      </form>
    </main>
  );
}
