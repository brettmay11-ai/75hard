"use client";

import { useEffect, useMemo, useState } from "react";

type WellnessEntry = {
  date: string;
  habits: Record<string, boolean>;
  water: number;
  sleep: number;
  mood: number;
  energy: number;
  movement: number;
  note: string;
};

type WellnessState = { entries: Record<string, WellnessEntry> };

const STORAGE_KEY = "personal-wellness-journal";
const HABITS = [
  { id: "morning", label: "Morning routine", detail: "Start without the scroll" },
  { id: "outside", label: "Time outside", detail: "A little daylight counts" },
  { id: "movement", label: "Move your body", detail: "Walk, train, stretch" },
  { id: "winddown", label: "Evening wind-down", detail: "Make room for rest" },
];

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function createEntry(date: string): WellnessEntry {
  return { date, habits: Object.fromEntries(HABITS.map((habit) => [habit.id, false])), water: 0, sleep: 7, mood: 3, energy: 3, movement: 0, note: "" };
}

function scoreEntry(entry: WellnessEntry) {
  const habits = Object.values(entry.habits).filter(Boolean).length / HABITS.length;
  return Math.round(((habits + Math.min(entry.water / 8, 1) + Math.min(entry.movement / 30, 1) + (entry.sleep >= 7 ? 1 : entry.sleep / 7)) / 4) * 100);
}

export default function Home() {
  const today = dateKey();
  const [state, setState] = useState<WellnessState>({ entries: {} });
  const [selectedDate, setSelectedDate] = useState(today);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try { setState(JSON.parse(saved) as WellnessState); } catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    setLoaded(true);
  }, []);

  useEffect(() => { if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [loaded, state]);

  const entry = state.entries[selectedDate] ?? createEntry(selectedDate);
  const score = scoreEntry(entry);
  const isToday = selectedDate === today;
  const recentDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (6 - index));
    return dateKey(date);
  }), [today]);

  function updateEntry(next: WellnessEntry) { setState((current) => ({ ...current, entries: { ...current.entries, [next.date]: next } })); }
  function updateField<Key extends keyof WellnessEntry>(key: Key, value: WellnessEntry[Key]) { updateEntry({ ...entry, [key]: value }); }
  function toggleHabit(id: string) { updateEntry({ ...entry, habits: { ...entry.habits, [id]: !entry.habits[id] } }); }

  return (
    <main className="wellness-app">
      <div className="wellness-shell">
        <header className="topbar">
          <div className="brand-lockup"><span className="brand-mark">W</span><div><p className="eyebrow">Personal wellness</p><h1>Well / Being</h1></div></div>
          <button className="icon-button" onClick={() => setSelectedDate(today)} type="button">Today</button>
        </header>

        <section className="welcome-row">
          <div><p className="eyebrow">{isToday ? "Your daily reset" : "Looking back"}</p><h2>{isToday ? "How are you, really?" : selectedDate}</h2><p className="muted">Small signals. Better decisions. A little more of you.</p></div>
          <div className="score-ring" style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><span>wellness<br />score</span></div>
        </section>

        <nav className="date-strip" aria-label="Recent days">
          {recentDates.map((date) => {
            const dayScore = state.entries[date] ? scoreEntry(state.entries[date]) : 0;
            return <button className={selectedDate === date ? "date-pill date-pill-active" : "date-pill"} key={date} onClick={() => setSelectedDate(date)} type="button"><span>{new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(new Date(`${date}T12:00:00`))}</span><strong>{new Date(`${date}T12:00:00`).getDate()}</strong><i className={dayScore > 0 ? "date-dot date-dot-filled" : "date-dot"} /></button>;
          })}
        </nav>

        <div className="wellness-grid">
          <section className="surface habit-surface"><div className="section-heading"><div><p className="eyebrow">Daily anchors</p><h3>Keep it simple</h3></div><span className="section-count">{Object.values(entry.habits).filter(Boolean).length}/{HABITS.length}</span></div><div className="habit-list">{HABITS.map((habit) => <button className={entry.habits[habit.id] ? "habit-row habit-row-done" : "habit-row"} key={habit.id} onClick={() => toggleHabit(habit.id)} type="button"><span className="habit-check">{entry.habits[habit.id] ? "✓" : ""}</span><span className="habit-copy"><strong>{habit.label}</strong><small>{habit.detail}</small></span><span className="habit-arrow">›</span></button>)}</div></section>

          <section className="surface hydration-surface"><div className="section-heading"><div><p className="eyebrow">Hydration</p><h3>Water check</h3></div><strong className="big-number">{entry.water}<small>/ 8 glasses</small></strong></div><div className="glass-row" aria-label="Water glasses">{Array.from({ length: 8 }, (_, index) => <button className={index < entry.water ? "water-glass water-glass-full" : "water-glass"} key={index} onClick={() => updateField("water", index + 1 === entry.water ? index : index + 1)} type="button" aria-label={`Set water to ${index + 1} glasses`}><span /></button>)}</div><p className="muted">Tap a glass to log where you are.</p></section>

          <section className="surface metrics-surface"><div className="section-heading"><div><p className="eyebrow">Body signals</p><h3>Check in</h3></div><span className="signal-badge">No judgment</span></div><div className="metric-row"><div><strong>Sleep</strong><small>hours last night</small></div><output>{entry.sleep.toFixed(1)}</output><input aria-label="Hours of sleep" max="12" min="0" onChange={(event) => updateField("sleep", Number(event.target.value))} step="0.5" type="range" value={entry.sleep} /></div><div className="metric-row"><div><strong>Movement</strong><small>minutes today</small></div><output>{entry.movement}</output><input aria-label="Minutes of movement" max="180" min="0" onChange={(event) => updateField("movement", Number(event.target.value))} step="5" type="range" value={entry.movement} /></div><div className="metric-row"><div><strong>Energy</strong><small>how charged are you?</small></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <button className={entry.energy === value ? "scale-button scale-button-active" : "scale-button"} key={value} onClick={() => updateField("energy", value)} type="button">{value}</button>)}</div></div><div className="metric-row"><div><strong>Mood</strong><small>what is present?</small></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <button className={entry.mood === value ? "scale-button scale-button-active" : "scale-button"} key={value} onClick={() => updateField("mood", value)} type="button">{value}</button>)}</div></div></section>

          <section className="surface note-surface"><div className="section-heading"><div><p className="eyebrow">Reflection</p><h3>Leave a note</h3></div><span className="note-prompt">What helped today?</span></div><textarea aria-label="Daily reflection" onChange={(event) => updateField("note", event.target.value)} placeholder="A win, a worry, something you noticed..." value={entry.note} /></section>
        </div>
        <footer className="privacy-note"><span className="privacy-dot" /> Your check-ins stay on this device.</footer>
      </div>
    </main>
  );
}
