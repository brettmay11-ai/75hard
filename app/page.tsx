"use client";

import { Activity, ArrowLeft, Bike, ChartNoAxesColumn, Check, CheckCheck, Dumbbell, Footprints, House, Play, Settings, WavesLadder, type LucideIcon } from "lucide-react";
import { type TouchEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";

type WorkoutType = "none" | "strength" | "run" | "cycle" | "sport" | "mobility";
type PlanStatus = "planned" | "started" | "complete";
type Entry = { date: string; habits: Record<string, boolean>; water: number; movement: number; workoutType: WorkoutType; note: string; planStatus: PlanStatus };
type State = { entries: Record<string, Entry> };
type OuraWorkout = Record<string, unknown>;
type Oura = { sleepScore?: number; readinessScore?: number; activityScore?: number; steps?: number; recentWorkouts?: string[]; workouts?: OuraWorkout[]; syncedAt?: string };
type Tab = "today" | "exercise" | "plan" | "trends" | "settings";
type Band = "none" | "low" | "steady" | "high";
type Prescription = { mode: string; title: string; reason: string; moves: string[]; recovery: string[]; food: string[] };

const STORAGE_KEY = "personal-wellness-journal";
const WATER_GOAL = 8;

const HABITS = [
  { id: "morning", label: "Morning routine", detail: "Start without the scroll" },
  { id: "outside", label: "Time outside", detail: "A little daylight counts" },
  { id: "movement", label: "Move your body", detail: "Walk, train, stretch" },
  { id: "winddown", label: "Evening wind-down", detail: "Make room for rest" },
];

const NAV: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: "today", label: "Today", icon: House },
  { id: "exercise", label: "Exercise", icon: Dumbbell },
  { id: "trends", label: "Trends", icon: ChartNoAxesColumn },
  { id: "settings", label: "Settings", icon: Settings },
];

const WORKOUT_TYPES: { value: WorkoutType; label: string }[] = [
  { value: "none", label: "Nothing yet" },
  { value: "strength", label: "Strength" },
  { value: "run", label: "Run" },
  { value: "cycle", label: "Cycle" },
  { value: "sport", label: "Sport" },
  { value: "mobility", label: "Mobility" },
];

const BAND_LABEL: Record<Band, string> = { none: "No score yet", low: "Take it easy", steady: "Steady", high: "Strong" };
const PLAN_ACTION: Record<PlanStatus, { label: string; icon: LucideIcon; hint: string }> = {
  planned: { label: "Start", icon: Play, hint: "Start today's plan" },
  started: { label: "Finish", icon: Check, hint: "Mark today's plan complete" },
  complete: { label: "Done", icon: CheckCheck, hint: "Today's plan is complete. Activate to undo." },
};

function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseDate(date: string) {
  return new Date(`${date}T12:00:00`);
}

function formatDay(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-US", options).format(parseDate(date));
}

function greeting(date = new Date()) {
  const hour = date.getHours();
  return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

function createEntry(date: string): Entry {
  return { date, habits: Object.fromEntries(HABITS.map((habit) => [habit.id, false])), water: 0, movement: 0, workoutType: "none", note: "", planStatus: "planned" };
}

function normalize(entry: Partial<Entry>, date: string): Entry {
  const base = createEntry(date);
  return { ...base, ...entry, habits: { ...base.habits, ...entry.habits }, planStatus: entry.planStatus ?? "planned" };
}

function habitsDone(entry: Entry) {
  return Object.values(entry.habits).filter(Boolean).length;
}

function hasLog(entry: Entry) {
  return habitsDone(entry) > 0 || entry.water > 0 || entry.planStatus !== "planned" || entry.workoutType !== "none" || entry.note.trim() !== "";
}

function ouraSignals(oura?: Oura | null) {
  return [oura?.readinessScore, oura?.sleepScore, oura?.activityScore].filter((value): value is number => typeof value === "number");
}

function personalScore(entry: Entry) {
  const habits = habitsDone(entry) / HABITS.length;
  const water = Math.min(entry.water / WATER_GOAL, 1);
  const movement = entry.planStatus === "complete" ? 1 : entry.planStatus === "started" ? 0.5 : 0;
  return habits * 0.5 + water * 0.3 + movement * 0.2;
}

function scoreFor(entry: Entry, oura?: Oura | null): number | null {
  const signals = ouraSignals(oura);
  if (!signals.length && !hasLog(entry)) return null;
  const personal = personalScore(entry);
  const blended = signals.length ? (signals.reduce((total, value) => total + value, 0) / signals.length / 100) * 0.65 + personal * 0.35 : personal;
  return Math.round(blended * 100);
}

function scoreBand(value: number | null): Band {
  return value === null ? "none" : value >= 80 ? "high" : value >= 60 ? "steady" : "low";
}

function prescription(entry: Entry, history: Entry[], oura: Oura | null, limit: string, equipment: string, override: string): Prescription {
  const readiness = oura?.readinessScore ?? 70;
  const sleep = oura?.sleepScore ?? 70;
  const hardRun = [...history, entry].some((item) => item.workoutType === "run" && item.movement >= 35) || Boolean(oura?.recentWorkouts?.some((item) => /run|cycle|hike/i.test(item)));
  if (override === "recover" || readiness < 60 || sleep < 60) return { mode: "Recovery", title: "Recover on purpose", reason: "Your recent recovery signals call for low intensity and more room to rebuild.", moves: ["20 min easy walk", "2 rounds: 8 cat-cows + 8 world's greatest stretches per side", "10 min gentle mobility"], recovery: ["Breathe slowly for 3 minutes", "Keep effort conversational and finish feeling better"], food: ["Protein at each meal: eggs, yogurt, chicken, fish, tofu", "Colorful produce, soup, rice, potatoes, and steady fluids"] };
  if (readiness < 75 || sleep < 75) return { mode: "Active recovery", title: "Keep the body moving", reason: "Your signals support movement, but today is better suited to circulation and mobility than hard training.", moves: ["25-35 min easy walk, bike, or swim", "3 rounds: 8 world's greatest stretches per side", "2 rounds: 10 glute bridges + 8 dead bugs per side"], recovery: ["10 min easy stretching for hips, calves, and upper back", "Finish with energy left in the tank; no pushing through fatigue"], food: ["Protein at each meal: eggs, yogurt, chicken, fish, tofu", "Steady carbs: oats, rice, potatoes, fruit", "Hydrate consistently and include colorful produce"] };
  if (override === "push" || (readiness >= 82 && sleep >= 80)) return { mode: "Build", title: "Train with intent", reason: "Your sleep and readiness support a focused training day.", moves: ["Warm-up: 6 min brisk walk + mobility", equipment === "none" ? "Tempo squats: 4 x 10" : "Squat or leg press: 4 x 6-8", equipment === "none" ? "Push-ups: 4 x 8-15" : "Bench press: 4 x 6-10", "Romanian deadlift: 3 x 8-10", "Farmer carry: 4 x 40 sec"], recovery: ["8-10 min full-body stretching", "Easy walk later if stiff; protect tonight's sleep"], food: ["Protein at every meal: beef, poultry, fish, eggs, dairy, tofu", "Add carbs around training: oats, rice, potatoes, fruit", "Have a protein plus carb meal after training"] };
  if (hardRun) return { mode: "Balance", title: "Build the base", reason: "Recent activity has been demanding, so today balances strength and control.", moves: ["Goblet squat: 3 x 10", "Push-ups: 3 x 8-12", "1-arm row: 3 x 10 per side", "Dead bug: 3 x 8 per side", "10 min easy walk"], recovery: ["5-8 min calves, hips, and hamstrings", "Keep the next session easy if soreness rises"], food: ["Protein-forward meals: lean meat, fish, cottage cheese, beans", "Moderate carbs: oats, potatoes, rice, fruit", "Add vegetables and healthy fats"] };
  return { mode: "Steady", title: "Move and reset", reason: `A moderate session fits your current signals. ${limit} minute target.`, moves: ["5 min easy warm-up", "Run/walk intervals: 8 x 1 min steady, 1 min easy", equipment === "none" ? "Reverse lunges: 3 x 8 per side" : "Split squat: 3 x 8 per side", "Plank: 3 x 30-45 sec"], recovery: ["5 min slow breathing after training", "Gentle stretch for calves, hips, chest, and back"], food: ["Balanced plates: protein, whole-food carbs, vegetables", "Choose chicken, lentils, eggs, yogurt, rice, fruit, and greens", "Pair snacks with protein"] };
}

function workoutName(workout: OuraWorkout) {
  const raw = String(workout.type || workout.activity || workout.name || workout.label || "Workout").replaceAll("_", " ");
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function workoutDate(workout: OuraWorkout) {
  const raw = String(workout.day || workout.start_datetime || workout.start_time || "");
  if (!raw) return "Recent activity";
  const parsed = new Date(raw.length === 10 ? `${raw}T12:00:00` : raw);
  return Number.isNaN(parsed.getTime()) ? raw : new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric" }).format(parsed);
}

function workoutDuration(workout: OuraWorkout) {
  const seconds = Number(workout.duration || workout.duration_seconds);
  return Number.isFinite(seconds) && seconds > 0 ? `${Math.round(seconds / 60)} min` : "Duration unavailable";
}

function workoutIcon(name: string): LucideIcon {
  if (/run|jog/i.test(name)) return Footprints;
  if (/cycl|bike/i.test(name)) return Bike;
  if (/swim|pool/i.test(name)) return WavesLadder;
  if (/strength|weight|gym|training/i.test(name)) return Dumbbell;
  if (/walk|hike/i.test(name)) return Footprints;
  return Activity;
}

export default function Home() {
  const today = dateKey();
  const [state, setState] = useState<State>({ entries: {} });
  const [oura, setOura] = useState<Oura | null>(null);
  const [connected, setConnected] = useState(false);
  const [tab, setTab] = useState<Tab>("today");
  const [selectedDate, setSelectedDate] = useState(today);
  const [loaded, setLoaded] = useState(false);
  const [limit, setLimit] = useState("45");
  const [equipment, setEquipment] = useState("gym");
  const [override, setOverride] = useState("auto");
  const [noteState, setNoteState] = useState<{ date: string; status: "saving" | "saved" } | null>(null);
  const noteTimer = useRef<number | null>(null);
  const refreshStart = useRef<number | null>(null);
  const refreshDistance = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState(0);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as State;
        setState({ entries: Object.fromEntries(Object.entries(parsed.entries || {}).map(([date, item]) => [date, normalize(item, date)])) });
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [loaded, state]);

  const loadOura = useCallback(async (date: string) => {
    const statusResponse = await fetch("/api/integrations/status");
    const isConnected = statusResponse.ok ? Boolean(((await statusResponse.json()) as { oura?: boolean }).oura) : false;
    setConnected(isConnected);
    if (!isConnected) {
      setOura(null);
      return;
    }
    const response = await fetch(`/api/integrations/oura/data?date=${date}`);
    if (!response.ok) return;
    const data = (await response.json()) as { sleep?: Record<string, unknown>; readiness?: Record<string, unknown>; activity?: Record<string, unknown>; workouts?: OuraWorkout[] };
    const sleep = data.sleep || {};
    const readiness = data.readiness || {};
    const activity = data.activity || {};
    const workouts = data.workouts || [];
    setOura({
      sleepScore: Number(sleep.score) || undefined,
      readinessScore: Number(readiness.score) || undefined,
      activityScore: Number(activity.score) || undefined,
      steps: Number(activity.steps) || undefined,
      workouts,
      recentWorkouts: workouts.map(workoutName),
      syncedAt: new Date().toISOString(),
    });
  }, []);

  useEffect(() => {
    void loadOura(selectedDate);
  }, [loadOura, selectedDate]);

  const isToday = selectedDate === today;
  const entry = state.entries[selectedDate] ?? createEntry(selectedDate);
  const recentDates = useMemo(() => Array.from({ length: 7 }, (_, index) => {
    const date = parseDate(today);
    date.setDate(date.getDate() - (6 - index));
    return dateKey(date);
  }), [today]);
  const history = recentDates.slice(0, -1).map((date) => state.entries[date] ?? createEntry(date));
  const dayScore = (item: Entry) => scoreFor(item, item.date === selectedDate ? oura : null);
  const wellnessScore = dayScore(entry);
  const band = scoreBand(wellnessScore);
  const yesterday = state.entries[recentDates[recentDates.length - 2]];
  const yesterdayScore = yesterday ? scoreFor(yesterday) : null;
  const delta = wellnessScore !== null && yesterdayScore !== null ? wellnessScore - yesterdayScore : null;
  const plan = prescription(entry, history, oura, limit, equipment, override);
  const planAction = PLAN_ACTION[entry.planStatus];
  const noteStatus = noteState?.date === selectedDate ? noteState.status : "idle";
  const PlanActionIcon = planAction.icon;

  const update = (next: Entry) => setState((current) => ({ ...current, entries: { ...current.entries, [next.date]: next } }));
  const setField = <Key extends keyof Entry>(key: Key, value: Entry[Key]) => update({ ...entry, [key]: value });
  const toggle = (id: string) => update({ ...entry, habits: { ...entry.habits, [id]: !entry.habits[id] } });

  function changeNote(value: string) {
    setField("note", value);
    setNoteState({ date: selectedDate, status: "saving" });
    if (noteTimer.current) window.clearTimeout(noteTimer.current);
    noteTimer.current = window.setTimeout(() => setNoteState({ date: selectedDate, status: "saved" }), 700);
  }

  function advancePlan() {
    if (!isToday) {
      setSelectedDate(today);
      setTab("today");
      return;
    }
    const next: PlanStatus = entry.planStatus === "planned" ? "started" : entry.planStatus === "started" ? "complete" : "planned";
    update({ ...entry, planStatus: next });
    setTab("today");
  }

  function openDate(date: string) {
    setSelectedDate(date);
    setTab("today");
  }

  function touchStart(event: TouchEvent<HTMLElement>) {
    if (window.scrollY <= 0 && !refreshing) refreshStart.current = event.touches[0].clientY;
  }

  function touchMove(event: TouchEvent<HTMLElement>) {
    if (refreshStart.current === null || refreshing) return;
    const distance = event.touches[0].clientY - refreshStart.current;
    const next = distance > 0 ? Math.min(distance * 0.55, 92) : 0;
    refreshDistance.current = next;
    setRefreshProgress(next);
  }

  function touchEnd() {
    refreshStart.current = null;
    const pulled = refreshDistance.current >= 70;
    refreshDistance.current = 0;
    setRefreshProgress(0);
    if (!pulled) return;
    setRefreshing(true);
    void loadOura(selectedDate).finally(() => setRefreshing(false));
  }

  return <main className="wellness-app" onTouchCancel={touchEnd} onTouchEnd={touchEnd} onTouchMove={touchMove} onTouchStart={touchStart}>
    <div className={refreshProgress || refreshing ? "refresh-indicator refresh-indicator-visible" : "refresh-indicator"} style={{ transform: `translate(-50%, ${Math.max(refreshProgress - 58, -58)}px)` }} role="status">
      {refreshing ? "Refreshing" : refreshProgress >= 70 ? "Release to refresh" : "Pull to refresh"}
    </div>

    <div className="wellness-shell">
      {tab === "today" && <>
        <header className="day-header">
          <div>
            <p className="day-date">{formatDay(selectedDate, { weekday: "long", month: "long", day: "numeric" })}</p>
            <h1>{isToday ? greeting() : "A look back"}</h1>
            <p className="day-tagline">{isToday ? "How are you, really?" : "What you logged that day."}</p>
          </div>
          {!isToday && <button className="ghost-button" onClick={() => setSelectedDate(today)} type="button"><ArrowLeft aria-hidden="true" size={15} strokeWidth={2.4} />Today</button>}
        </header>

        <nav className="date-strip" aria-label="Recent days">
          {recentDates.map((date) => {
            const logged = Boolean(state.entries[date] && hasLog(state.entries[date]));
            return <button aria-current={selectedDate === date ? "date" : undefined} className={selectedDate === date ? "date-pill date-pill-active" : "date-pill"} key={date} onClick={() => setSelectedDate(date)} type="button">
              <span>{formatDay(date, { weekday: "short" })}</span>
              <strong>{parseDate(date).getDate()}</strong>
              <i className={logged ? "date-dot date-dot-filled" : "date-dot"} />
            </button>;
          })}
        </nav>

        <section className={`score-block score-band-${band}`} aria-label="Wellness score">
          <div className="score-ring" style={{ "--score": `${(wellnessScore ?? 0) * 3.6}deg` } as React.CSSProperties}>
            <strong>{wellnessScore ?? "—"}</strong>
            <span>wellness<br />score</span>
          </div>
          <div className="score-meta">
            <p className="score-band-label">{BAND_LABEL[band]}</p>
            {wellnessScore === null
              ? <p className="muted">{connected ? "Check in below to see today's score." : "Connect Oura or check in below to see your score."}</p>
              : <p className="muted">{delta === null ? "First scored day this week." : delta === 0 ? "Level with yesterday." : `${delta > 0 ? "+" : ""}${delta} vs yesterday.`}</p>}
          </div>
        </section>

        {connected
          ? <div className="oura-inline" aria-label="Oura recovery inputs">
              <span><strong>{oura?.readinessScore ?? "—"}</strong><small>readiness</small></span>
              <span><strong>{oura?.sleepScore ?? "—"}</strong><small>sleep</small></span>
              <span><strong>{oura?.activityScore ?? "—"}</strong><small>activity</small></span>
              <span><strong>{oura?.steps?.toLocaleString() ?? "—"}</strong><small>steps</small></span>
            </div>
          : <a className="connect-strip" href="/api/integrations/oura/start">
              <span><strong>Connect Oura</strong><small>Readiness and sleep make the plan yours.</small></span>
              <em>Connect</em>
            </a>}

        {isToday
          ? <section className="prescription-card">
              <div className="prescription-intro">
                <p className="eyebrow">Today&apos;s plan</p>
                <h2>{plan.title}</h2>
                <p>{plan.reason}</p>
              </div>
              <div className="prescription-tags">
                <span className="prescription-label">{plan.mode}</span>
                {!connected && <span className="prescription-label prescription-label-generic">Generic</span>}
              </div>

              {!connected && <p className="prescription-notice">This is a general plan. Connect Oura and it adapts to your readiness and sleep.</p>}

              <div className="prescription-controls">
                <label>Time
                  <select value={limit} onChange={(event) => setLimit(event.target.value)}>
                    <option value="20">20 min</option>
                    <option value="30">30 min</option>
                    <option value="45">45 min</option>
                    <option value="60">60 min</option>
                  </select>
                </label>
                <label>Equipment
                  <select value={equipment} onChange={(event) => setEquipment(event.target.value)}>
                    <option value="gym">Gym</option>
                    <option value="home">Home basics</option>
                    <option value="none">No equipment</option>
                  </select>
                </label>
                <label>Override
                  <select value={override} onChange={(event) => setOverride(event.target.value)}>
                    <option value="auto">Auto</option>
                    <option value="push">Push</option>
                    <option value="recover">Recover</option>
                  </select>
                </label>
              </div>

              <ol className="prescription-list">{plan.moves.map((move) => <li key={move}>{move}</li>)}</ol>

              <div className="prescription-footer">
                <p className={`plan-status plan-status-${entry.planStatus}`}>
                  {entry.planStatus === "complete" ? "Completed today" : entry.planStatus === "started" ? "In progress" : "Not started"}
                </p>
                <button className="ghost-button ghost-button-invert" onClick={() => setTab("plan")} type="button">Full plan</button>
              </div>
            </section>
          : <section className="surface day-summary">
              <div className="section-heading">
                <div>
                  <p className="eyebrow">That day</p>
                  <h2>{hasLog(entry) ? "Here’s what you logged" : "Nothing logged"}</h2>
                </div>
                <span className="section-count">{wellnessScore ?? "—"}</span>
              </div>
              <dl className="summary-grid">
                <div><dt>Anchors</dt><dd>{habitsDone(entry)}/{HABITS.length}</dd></div>
                <div><dt>Water</dt><dd>{entry.water}/{WATER_GOAL}</dd></div>
                <div><dt>Workout</dt><dd>{entry.planStatus === "complete" ? "Complete" : entry.workoutType === "none" ? "None" : WORKOUT_TYPES.find((item) => item.value === entry.workoutType)?.label}</dd></div>
              </dl>
              {entry.note && <p className="summary-note">{entry.note}</p>}
            </section>}

        <div className="wellness-grid">
          <section className="surface habit-surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Daily anchors</p>
                <h2>Keep it simple</h2>
              </div>
              <span className="section-count">{habitsDone(entry)}/{HABITS.length}</span>
            </div>
            <div className="habit-list">
              {HABITS.map((habit) => <button aria-pressed={entry.habits[habit.id]} className={entry.habits[habit.id] ? "habit-row habit-row-done" : "habit-row"} key={habit.id} onClick={() => toggle(habit.id)} type="button">
                <span className="habit-check" aria-hidden="true">{entry.habits[habit.id] && <Check size={16} strokeWidth={3} />}</span>
                <span className="habit-copy"><strong>{habit.label}</strong><small>{habit.detail}</small></span>
              </button>)}
            </div>
          </section>

          <section className="surface hydration-surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Hydration</p>
                <h2>Water check</h2>
              </div>
              <strong className="big-number">{entry.water}<small>/ {WATER_GOAL} glasses</small></strong>
            </div>
            <div className="glass-row">
              {Array.from({ length: WATER_GOAL }, (_, index) => <button aria-label={`Set water to ${index + 1} ${index === 0 ? "glass" : "glasses"}`} aria-pressed={index < entry.water} className={index < entry.water ? "water-glass water-glass-full" : "water-glass"} key={index} onClick={() => setField("water", index + 1 === entry.water ? index : index + 1)} type="button"><span /></button>)}
            </div>
            <p className="muted">Tap a glass to log where you are.</p>
            <div className="workout-log">
              <label htmlFor="workout-type">Movement</label>
              <select id="workout-type" onChange={(event) => setField("workoutType", event.target.value as WorkoutType)} value={entry.workoutType}>
                {WORKOUT_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              {entry.workoutType !== "none" && <label className="workout-minutes">
                <input aria-label="Minutes moved" inputMode="numeric" max={300} min={0} onChange={(event) => setField("movement", Math.max(0, Math.min(300, Number(event.target.value) || 0)))} type="number" value={entry.movement || ""} />
                min
              </label>}
            </div>
          </section>

          <section className="surface note-surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Reflection</p>
                <h2>Leave a note</h2>
              </div>
              <span className="save-state" aria-live="polite">{noteStatus === "saving" ? "Saving…" : noteStatus === "saved" ? "Saved" : ""}</span>
            </div>
            <textarea aria-label="Daily reflection" onChange={(event) => changeNote(event.target.value)} placeholder="A win, a worry, something you noticed..." value={entry.note} />
          </section>
        </div>
      </>}

      {tab === "plan" && <section className="page-section">
        <button className="ghost-button" onClick={() => setTab("today")} type="button"><ArrowLeft aria-hidden="true" size={15} strokeWidth={2.4} />Today</button>
        <p className="eyebrow">Your daily plan</p>
        <h1>{plan.title}</h1>
        <p className="muted">{connected ? "Shaped by your Oura recovery signals and recent movement." : "A general plan. Connect Oura and it adapts to your readiness and sleep."}</p>
        <div className="detail-grid">
          <article>
            <p className="detail-label">Training</p>
            <ol>{plan.moves.map((move) => <li key={move}>{move}</li>)}</ol>
          </article>
          <article>
            <p className="detail-label">Stretch + recovery</p>
            <ul>{plan.recovery.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
          <article>
            <p className="detail-label">Food focus</p>
            <ul>{plan.food.map((item) => <li key={item}>{item}</li>)}</ul>
          </article>
        </div>
        <div className="prescription-why">
          <strong>Why this plan</strong>
          <p>{plan.reason}</p>
          <dl className="summary-grid">
            <div><dt>Readiness</dt><dd>{oura?.readinessScore ?? "—"}</dd></div>
            <div><dt>Sleep</dt><dd>{oura?.sleepScore ?? "—"}</dd></div>
            <div><dt>Activity</dt><dd>{oura?.activityScore ?? "—"}</dd></div>
          </dl>
        </div>
      </section>}

      {tab === "exercise" && <section className="page-section">
        <p className="eyebrow">Exercise</p>
        <h1>Recent workouts</h1>
        <p className="muted">Your movement history from Oura, kept separate so today&apos;s plan stays easy to scan.</p>
        {connected
          ? <div className="exercise-list">
              {oura?.workouts?.length
                ? oura.workouts.map((workout, index) => {
                    const name = workoutName(workout);
                    const Icon = workoutIcon(name);
                    return <article className="exercise-row" key={`${workout.id || index}`}>
                      <span className="exercise-icon"><Icon aria-hidden="true" size={18} strokeWidth={2} /></span>
                      <div><strong>{name}</strong><small>{workoutDate(workout)}</small></div>
                      <span className="exercise-duration">{workoutDuration(workout)}</span>
                    </article>;
                  })
                : <div className="empty-state">
                    <strong>No recent workouts</strong>
                    <p>Once Oura records a workout it shows up here. Pull down to refresh.</p>
                  </div>}
            </div>
          : <div className="empty-state">
              <strong>Connect Oura to see your workouts</strong>
              <p>Activity type, duration, and dates will appear here.</p>
              <a href="/api/integrations/oura/start">Connect Oura</a>
            </div>}
      </section>}

      {tab === "trends" && <section className="page-section">
        <p className="eyebrow">Patterns, not perfection</p>
        <h1>Your week at a glance</h1>
        <p className="muted">Use trends to notice what helps, not to grade yourself.</p>
        <div className="trend-grid">
          {recentDates.map((date) => {
            const item = state.entries[date] ?? createEntry(date);
            const value = dayScore(item);
            return <div className="trend-row" key={date}>
              <strong>{formatDay(date, { weekday: "short" })}</strong>
              <div className={`trend-bar score-band-${scoreBand(value)}`}><span style={{ width: `${value ?? 0}%` }} /></div>
              <output>{value ?? "—"}</output>
            </div>;
          })}
        </div>
        {Object.values(state.entries).some(hasLog)
          ? <>
              <h2 className="section-title">Past check-ins</h2>
              <div className="history-list">
                {Object.values(state.entries).filter(hasLog).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map((item) => <button key={item.date} onClick={() => openDate(item.date)} type="button">
                  <span>
                    <strong>{formatDay(item.date, { weekday: "short", month: "short", day: "numeric" })}</strong>
                    <small>{habitsDone(item)}/{HABITS.length} anchors · {item.water}/{WATER_GOAL} water{item.planStatus === "complete" ? " · workout done" : ""}{item.note ? " · note" : ""}</small>
                  </span>
                  <output>{dayScore(item) ?? "—"}</output>
                </button>)}
              </div>
            </>
          : <div className="empty-state">
              <strong>Your week fills in as you go</strong>
              <p>Check in on the Today tab and your days will show up here.</p>
            </div>}
      </section>}

      {tab === "settings" && <section className="page-section">
        <p className="eyebrow">Your space</p>
        <h1>Settings</h1>
        <div className="settings-list">
          <div>
            <strong>Oura connection</strong>
            <small>{connected ? "Connected and read-only." : "Not connected."}</small>
            <a href="/api/integrations/oura/start">{connected ? "Reconnect Oura" : "Connect Oura"}</a>
          </div>
          <div>
            <strong>Privacy</strong>
            <small>Your check-ins are stored on this device.</small>
            <div className="settings-actions">
              <button onClick={() => {
                const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = `well-being-${today}.json`;
                link.click();
                URL.revokeObjectURL(url);
              }} type="button">Export my data</button>
              <button className="danger-link" onClick={() => {
                if (window.confirm("Delete all local check-ins?")) {
                  setState({ entries: {} });
                  window.localStorage.removeItem(STORAGE_KEY);
                }
              }} type="button">Delete local data</button>
            </div>
          </div>
        </div>
      </section>}

      <footer className="privacy-note"><span className="privacy-dot" /> Your check-ins stay on this device.</footer>
    </div>

    <nav className="app-nav" aria-label="Main navigation">
      {NAV.slice(0, 2).map((item) => <NavButton active={tab === item.id} item={item} key={item.id} onSelect={() => setTab(item.id)} />)}
      <button aria-label={planAction.hint} className={`nav-action nav-action-${entry.planStatus}`} onClick={advancePlan} type="button">
        <span className="nav-icon"><PlanActionIcon aria-hidden="true" size={20} strokeWidth={2.4} /></span>
        <span className="nav-label">{planAction.label}</span>
      </button>
      {NAV.slice(2).map((item) => <NavButton active={tab === item.id} item={item} key={item.id} onSelect={() => setTab(item.id)} />)}
    </nav>
  </main>;
}

function NavButton({ active, item, onSelect }: { active: boolean; item: { id: Tab; label: string; icon: LucideIcon }; onSelect: () => void }) {
  const Icon = item.icon;
  return <button aria-current={active ? "page" : undefined} className={active ? "nav-button nav-button-active" : "nav-button"} onClick={onSelect} type="button">
    <span className="nav-icon"><Icon aria-hidden="true" size={19} strokeWidth={2} /></span>
    <span className="nav-label">{item.label}</span>
  </button>;
}
