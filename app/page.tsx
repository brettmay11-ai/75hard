"use client";

import { type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

type WellnessEntry = {
  date: string;
  habits: Record<string, boolean>;
  water: number;
  sleep: number;
  mood: number;
  energy: number;
  movement: number;
  recovery: number;
  workoutType: "none" | "strength" | "run" | "cycle" | "sport" | "mobility";
  note: string;
};

type WellnessState = { entries: Record<string, WellnessEntry> };
type OuraSnapshot = { sleepScore?: number; readinessScore?: number; activityScore?: number; sleepHours?: number; steps?: number };

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
  return { date, habits: Object.fromEntries(HABITS.map((habit) => [habit.id, false])), water: 0, sleep: 7, mood: 3, energy: 3, movement: 0, recovery: 3, workoutType: "none", note: "" };
}

function normalizeEntry(entry: Partial<WellnessEntry>, date: string): WellnessEntry {
  return { ...createEntry(date), ...entry, habits: { ...createEntry(date).habits, ...entry.habits }, recovery: entry.recovery ?? 3, workoutType: entry.workoutType ?? "none" };
}

function scoreEntry(entry: WellnessEntry) {
  const habits = Object.values(entry.habits).filter(Boolean).length / HABITS.length;
  return Math.round(((habits + Math.min(entry.water / 8, 1) + Math.min(entry.movement / 30, 1) + (entry.sleep >= 7 ? 1 : entry.sleep / 7)) / 4) * 100);
}

type Prescription = { label: string; title: string; why: string; moves: string[] };

function getPrescription(entry: WellnessEntry, history: WellnessEntry[], oura?: OuraSnapshot | null): Prescription {
  const recovery = oura?.readinessScore ? Math.ceil(oura.readinessScore / 20) : entry.recovery;
  const sleep = oura?.sleepHours ?? entry.sleep;
  const recent = history.filter((item) => item.workoutType !== "none").slice(-3);
  const hasHardRun = recent.some((item) => item.workoutType === "run" && item.movement >= 35);
  if (recovery <= 2 || sleep < 6) {
    return { label: "Low load", title: "Recover on purpose", why: "Your sleep or recovery signal is asking for less intensity today.", moves: ["20 min easy walk", "2 rounds: 8 cat-cows, 8 world's greatest stretches per side", "3 x 45 sec relaxed breathing"] };
  }
  if (hasHardRun) {
    return { label: "Balance day", title: "Build the base", why: "You have a hard run in the recent mix, so today shifts toward strength and control.", moves: ["Goblet squat: 3 x 10", "Push-ups: 3 x 8-12", "1-arm row: 3 x 10 per side", "Dead bug: 3 x 8 per side", "10 min easy walk cooldown"] };
  }
  if (recovery >= 4 && entry.energy >= 4 && sleep >= 7) {
    return { label: "High readiness", title: "Train with intent", why: "Your current signals support a focused strength session.", moves: ["Warm-up: 6 min brisk walk + mobility", "Squat or leg press: 4 x 6-8", "Bench press or push-ups: 4 x 6-10", "Romanian deadlift: 3 x 8-10", "Farmer carry: 4 x 40 sec"] };
  }
  return { label: "Steady effort", title: "Move and reset", why: "A moderate session keeps momentum without borrowing from tomorrow.", moves: ["5 min easy warm-up", "Run/walk intervals: 8 x 1 min steady, 1 min easy", "Reverse lunges: 3 x 8 per side", "Plank: 3 x 30-45 sec", "5 min cooldown stretch"] };
}

export default function Home() {
  const today = dateKey();
  const [state, setState] = useState<WellnessState>({ entries: {} });
  const [selectedDate, setSelectedDate] = useState(today);
  const [loaded, setLoaded] = useState(false);
  const [connections, setConnections] = useState({ oura: false, strava: false });
  const [connectionMessage, setConnectionMessage] = useState("");
  const [ouraData, setOuraData] = useState<OuraSnapshot | null>(null);
  const [ouraDataMessage, setOuraDataMessage] = useState("");
  const refreshStartY = useRef<number | null>(null);
  const refreshDistance = useRef(0);
  const [refreshProgress, setRefreshProgress] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as WellnessState;
        setState({ entries: Object.fromEntries(Object.entries(parsed.entries || {}).map(([date, item]) => [date, normalizeEntry(item, date)])) });
      } catch { window.localStorage.removeItem(STORAGE_KEY); }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!connections.oura) return;
    void fetch(`/api/integrations/oura/data?date=${today}`).then(async (response) => {
      if (!response.ok) { setOuraDataMessage("Oura data needs a fresh connection."); return; }
      const payload = await response.json() as { sleep?: Record<string, unknown> | null; readiness?: Record<string, unknown> | null; activity?: Record<string, unknown> | null };
      const sleep = payload.sleep || {};
      const readiness = payload.readiness || {};
      const activity = payload.activity || {};
      setOuraData({ sleepScore: Number(sleep.score) || undefined, readinessScore: Number(readiness.score) || undefined, activityScore: Number(activity.score) || undefined, sleepHours: Number(sleep.total_sleep_duration) ? Number(sleep.total_sleep_duration) / 3600 : undefined, steps: Number(activity.steps) || undefined });
    });
  }, [connections.oura, today]);

  useEffect(() => { if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }, [loaded, state]);

  useEffect(() => {
    void fetch("/api/integrations/status").then(async (response) => {
      if (response.ok) setConnections(await response.json() as { oura: boolean; strava: boolean });
    });
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const error = params.get("integration_error");
    const detail = params.get("integration_detail");
    if (connected) setConnectionMessage(`${connected === "oura" ? "Oura" : "Strava"} connected.`);
    if (error) setConnectionMessage(`Could not connect ${error === "oura" ? "Oura" : "Strava"}${detail ? ` (${detail})` : ""}. Check the app settings and try again.`);
  }, []);

  const entry = state.entries[selectedDate] ?? createEntry(selectedDate);
  const score = scoreEntry(entry);
  const isToday = selectedDate === today;
  const recentDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = new Date(`${today}T12:00:00`);
    date.setDate(date.getDate() - (6 - index));
    return dateKey(date);
  }), [today]);
  const prescription = getPrescription(entry, recentDates.slice(0, -1).map((date) => state.entries[date] ?? createEntry(date)), ouraData);

  function updateEntry(next: WellnessEntry) { setState((current) => ({ ...current, entries: { ...current.entries, [next.date]: next } })); }
  function updateField<Key extends keyof WellnessEntry>(key: Key, value: WellnessEntry[Key]) { updateEntry({ ...entry, [key]: value }); }
  function toggleHabit(id: string) { updateEntry({ ...entry, habits: { ...entry.habits, [id]: !entry.habits[id] } }); }

  function handleTouchStart(event: TouchEvent<HTMLElement>) {
    if (window.scrollY <= 0 && !refreshing) refreshStartY.current = event.touches[0].clientY;
  }

  function handleTouchMove(event: TouchEvent<HTMLElement>) {
    if (refreshStartY.current === null || refreshing) return;
    const distance = event.touches[0].clientY - refreshStartY.current;
    const next = distance > 0 ? Math.min(distance * 0.55, 92) : 0;
    refreshDistance.current = next;
    setRefreshProgress(next);
  }

  function handleTouchEnd() {
    refreshStartY.current = null;
    if (refreshDistance.current >= 70) {
      setRefreshing(true);
      window.setTimeout(() => window.location.reload(), 220);
    } else {
      refreshDistance.current = 0;
      setRefreshProgress(0);
    }
  }

  return (
    <main className="wellness-app" onTouchCancel={handleTouchEnd} onTouchEnd={handleTouchEnd} onTouchMove={handleTouchMove} onTouchStart={handleTouchStart}>
      <div className={refreshProgress > 0 || refreshing ? "refresh-indicator refresh-indicator-visible" : "refresh-indicator"} style={{ transform: `translate(-50%, ${Math.max(refreshProgress - 58, -58)}px)` }} aria-hidden={refreshProgress === 0 && !refreshing}>{refreshing ? "Refreshing" : refreshProgress >= 70 ? "Release to refresh" : "Pull to refresh"}</div>
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

          <section className="prescription-card">
          <div className="prescription-intro"><p className="eyebrow">Today&apos;s prescription</p><h3>{prescription.title}</h3><p>{prescription.why}</p></div>
          <span className="prescription-label">{prescription.label}</span>
          <ol className="prescription-list">{prescription.moves.map((move) => <li key={move}>{move}</li>)}</ol>
        </section>

        {connections.oura && <section className="oura-snapshot"><div><p className="eyebrow">Oura sync</p><h3>Your recovery inputs</h3></div><div className="oura-stats"><span><strong>{ouraData?.readinessScore ?? "--"}</strong><small>readiness</small></span><span><strong>{ouraData?.sleepHours ? `${ouraData.sleepHours.toFixed(1)}h` : "--"}</strong><small>sleep</small></span><span><strong>{ouraData?.activityScore ?? "--"}</strong><small>activity</small></span><span><strong>{ouraData?.steps?.toLocaleString() ?? "--"}</strong><small>steps</small></span></div>{ouraDataMessage && <p className="connection-message">{ouraDataMessage}</p>}</section>}

        <div className="wellness-grid">
          <section className="surface habit-surface"><div className="section-heading"><div><p className="eyebrow">Daily anchors</p><h3>Keep it simple</h3></div><span className="section-count">{Object.values(entry.habits).filter(Boolean).length}/{HABITS.length}</span></div><div className="habit-list">{HABITS.map((habit) => <button className={entry.habits[habit.id] ? "habit-row habit-row-done" : "habit-row"} key={habit.id} onClick={() => toggleHabit(habit.id)} type="button"><span className="habit-check">{entry.habits[habit.id] ? "✓" : ""}</span><span className="habit-copy"><strong>{habit.label}</strong><small>{habit.detail}</small></span><span className="habit-arrow">›</span></button>)}</div></section>

          <section className="surface hydration-surface"><div className="section-heading"><div><p className="eyebrow">Hydration</p><h3>Water check</h3></div><strong className="big-number">{entry.water}<small>/ 8 glasses</small></strong></div><div className="glass-row" aria-label="Water glasses">{Array.from({ length: 8 }, (_, index) => <button className={index < entry.water ? "water-glass water-glass-full" : "water-glass"} key={index} onClick={() => updateField("water", index + 1 === entry.water ? index : index + 1)} type="button" aria-label={`Set water to ${index + 1} glasses`}><span /></button>)}</div><p className="muted">Tap a glass to log where you are.</p></section>

          <section className="surface metrics-surface"><div className="section-heading"><div><p className="eyebrow">Body signals</p><h3>Check in</h3></div><span className="signal-badge">No judgment</span></div><div className="metric-row"><div><strong>Sleep</strong><small>hours last night</small></div><output>{entry.sleep.toFixed(1)}</output><input aria-label="Hours of sleep" max="12" min="0" onChange={(event) => updateField("sleep", Number(event.target.value))} step="0.5" type="range" value={entry.sleep} /></div><div className="metric-row"><div><strong>Recovery</strong><small>how ready do you feel?</small></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <button className={entry.recovery === value ? "scale-button scale-button-active" : "scale-button"} key={value} onClick={() => updateField("recovery", value)} type="button">{value}</button>)}</div></div><div className="metric-row"><div><strong>Movement</strong><small>minutes today</small></div><output>{entry.movement}</output><input aria-label="Minutes of movement" max="180" min="0" onChange={(event) => updateField("movement", Number(event.target.value))} step="5" type="range" value={entry.movement} /></div><div className="metric-row"><div><strong>Energy</strong><small>how charged are you?</small></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <button className={entry.energy === value ? "scale-button scale-button-active" : "scale-button"} key={value} onClick={() => updateField("energy", value)} type="button">{value}</button>)}</div></div><div className="metric-row"><div><strong>Mood</strong><small>what is present?</small></div><div className="scale-buttons">{[1, 2, 3, 4, 5].map((value) => <button className={entry.mood === value ? "scale-button scale-button-active" : "scale-button"} key={value} onClick={() => updateField("mood", value)} type="button">{value}</button>)}</div></div><label className="workout-log"><span>Last workout</span><select aria-label="Last workout type" onChange={(event) => updateField("workoutType", event.target.value as WellnessEntry["workoutType"])} value={entry.workoutType}><option value="none">Not logged</option><option value="strength">Strength</option><option value="run">Run</option><option value="cycle">Cycle</option><option value="sport">Sport</option><option value="mobility">Mobility</option></select></label></section>

          <section className="surface note-surface"><div className="section-heading"><div><p className="eyebrow">Reflection</p><h3>Leave a note</h3></div><span className="note-prompt">What helped today?</span></div><textarea aria-label="Daily reflection" onChange={(event) => updateField("note", event.target.value)} placeholder="A win, a worry, something you noticed..." value={entry.note} /></section>

          <section className="surface integrations-surface"><div className="section-heading"><div><p className="eyebrow">Connected data</p><h3>Bring your numbers with you</h3></div><span className="signal-badge">Read-only</span></div><p className="muted">Log in securely through Oura or Strava. The app only requests the data needed for your wellness view.</p><div className="integration-list"><div className="integration-row"><span className="integration-logo integration-logo-oura">O</span><div><strong>Oura</strong><small>Sleep, readiness, recovery</small></div><a className={connections.oura ? "integration-action integration-action-connected" : "integration-action"} href="/api/integrations/oura/start">{connections.oura ? "Connected" : "Log in"}</a></div><div className="integration-row"><span className="integration-logo integration-logo-strava">S</span><div><strong>Strava</strong><small>Runs, walks, rides, workouts</small></div><a className={connections.strava ? "integration-action integration-action-connected" : "integration-action"} href="/api/integrations/strava/start">{connections.strava ? "Connected" : "Log in"}</a></div></div>{connectionMessage && <p className="connection-message" role="status">{connectionMessage}</p>}</section>
        </div>
        <footer className="privacy-note"><span className="privacy-dot" /> Your check-ins stay on this device.</footer>
      </div>
    </main>
  );
}
