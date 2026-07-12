"use client";

import { useEffect, useMemo, useState } from "react";

type DayRecord = {
  date: string;
  diet: boolean;
  workoutIndoor: boolean;
  workoutOutdoor: boolean;
  water: boolean;
  reading: boolean;
  photo: boolean;
  note: string;
};

type TrackerState = {
  startDate: string;
  records: Record<string, DayRecord>;
};

const TASKS = [
  { key: "diet", label: "Diet followed", detail: "No cheats, no alcohol" },
  { key: "workoutIndoor", label: "Workout 1", detail: "45 minutes" },
  { key: "workoutOutdoor", label: "Workout 2 outdoors", detail: "45 minutes outside" },
  { key: "water", label: "Water", detail: "1 gallon" },
  { key: "reading", label: "Read", detail: "10 pages" },
  { key: "photo", label: "Progress photo", detail: "Daily check-in" },
] as const;

const STORAGE_KEY = "personal-75-hard-tracker";
const TOTAL_DAYS = 75;

function toDateInput(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(dateString: string, days: number) {
  const date = new Date(`${dateString}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateInput(date);
}

function diffDays(startDate: string, activeDate: string) {
  const start = new Date(`${startDate}T00:00:00`).getTime();
  const active = new Date(`${activeDate}T00:00:00`).getTime();
  return Math.floor((active - start) / 86400000) + 1;
}

function createRecord(date: string): DayRecord {
  return {
    date,
    diet: false,
    workoutIndoor: false,
    workoutOutdoor: false,
    water: false,
    reading: false,
    photo: false,
    note: "",
  };
}

function isComplete(record?: DayRecord) {
  return Boolean(record && TASKS.every((task) => record[task.key]));
}

export default function Home() {
  const today = toDateInput(new Date());
  const [state, setState] = useState<TrackerState>({
    startDate: today,
    records: { [today]: createRecord(today) },
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as TrackerState;
        setState(parsed);
        setSelectedDate(today);
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, [today]);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  }, [loaded, state]);

  const currentDay = Math.min(Math.max(diffDays(state.startDate, today), 1), TOTAL_DAYS);
  const selectedDay = diffDays(state.startDate, selectedDate);
  const selectedRecord = state.records[selectedDate] ?? createRecord(selectedDate);
  const completedDays = useMemo(
    () =>
      Array.from({ length: TOTAL_DAYS }, (_, index) => addDays(state.startDate, index)).filter(
        (date) => isComplete(state.records[date]),
      ).length,
    [state],
  );
  const selectedCompleted = TASKS.filter((task) => selectedRecord[task.key]).length;
  const progress = Math.round((completedDays / TOTAL_DAYS) * 100);
  const finishDate = addDays(state.startDate, TOTAL_DAYS - 1);

  function updateRecord(nextRecord: DayRecord) {
    setState((previous) => ({
      ...previous,
      records: {
        ...previous.records,
        [nextRecord.date]: nextRecord,
      },
    }));
  }

  function updateStartDate(startDate: string) {
    setState((previous) => ({ ...previous, startDate }));
    setSelectedDate(startDate);
  }

  function resetTracker() {
    const fresh = createRecord(today);
    setState({ startDate: today, records: { [today]: fresh } });
    setSelectedDate(today);
  }

  return (
    <main className="min-h-screen bg-[#f5f2eb] text-[#171512]">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-5 sm:px-6 lg:px-8">
        <header className="grid gap-4 border-b border-[#d8d0c2] pb-5 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#7c6b55]">
              Personal 75 Hard
            </p>
            <h1 className="mt-2 text-4xl font-black leading-none sm:text-6xl">Day {currentDay}</h1>
            <p className="mt-3 max-w-2xl text-base text-[#625746] sm:text-lg">
              Track the six daily promises, keep the streak honest, and see the full 75-day board at a glance.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center sm:min-w-[360px]">
            <div className="stat">
              <span>{completedDays}</span>
              <small>Done</small>
            </div>
            <div className="stat">
              <span>{progress}%</span>
              <small>Progress</small>
            </div>
            <div className="stat">
              <span>{Math.max(TOTAL_DAYS - completedDays, 0)}</span>
              <small>Left</small>
            </div>
          </div>
        </header>

        <div className="grid flex-1 gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-lg border border-[#d8d0c2] bg-[#fffaf0] p-4 shadow-sm sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-xl font-bold">Today&apos;s Commitments</h2>
                <p className="text-sm text-[#625746]">
                  {selectedDate} · Day {selectedDay > 0 ? selectedDay : 1} of {TOTAL_DAYS}
                </p>
              </div>
              <input
                aria-label="Choose day"
                className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm font-semibold"
                max={finishDate}
                min={state.startDate}
                onChange={(event) => setSelectedDate(event.target.value)}
                type="date"
                value={selectedDate}
              />
            </div>

            <div className="mt-5 grid gap-3">
              {TASKS.map((task) => (
                <label
                  className={`task-row ${selectedRecord[task.key] ? "task-row-complete" : ""}`}
                  key={task.key}
                >
                  <input
                    checked={selectedRecord[task.key]}
                    onChange={(event) =>
                      updateRecord({ ...selectedRecord, [task.key]: event.target.checked })
                    }
                    type="checkbox"
                  />
                  <span>
                    <strong>{task.label}</strong>
                    <small>{task.detail}</small>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-5 rounded-lg border border-[#d8d0c2] bg-white p-4">
              <label className="text-sm font-bold" htmlFor="note">
                Day note
              </label>
              <textarea
                className="mt-2 min-h-24 w-full resize-y rounded-md border border-[#c9beac] bg-[#fffdf8] p-3 text-sm outline-none focus:border-[#2f6f66]"
                id="note"
                onChange={(event) => updateRecord({ ...selectedRecord, note: event.target.value })}
                placeholder="Energy, meals, workouts, wins, lessons..."
                value={selectedRecord.note}
              />
            </div>
          </section>

          <aside className="flex flex-col gap-5">
            <section className="rounded-lg border border-[#d8d0c2] bg-[#171512] p-5 text-white shadow-sm">
              <h2 className="text-xl font-bold">Daily Score</h2>
              <div className="mt-5 flex items-end gap-2">
                <span className="text-6xl font-black">{selectedCompleted}</span>
                <span className="pb-2 text-lg text-[#d4c8b8]">/ {TASKS.length}</span>
              </div>
              <div className="mt-5 h-3 overflow-hidden rounded-full bg-[#40382e]">
                <div
                  className="h-full rounded-full bg-[#59b88d]"
                  style={{ width: `${(selectedCompleted / TASKS.length) * 100}%` }}
                />
              </div>
              <p className="mt-4 text-sm text-[#d4c8b8]">
                Finish date: <strong className="text-white">{finishDate}</strong>
              </p>
            </section>

            <section className="rounded-lg border border-[#d8d0c2] bg-[#fffaf0] p-5 shadow-sm">
              <h2 className="text-xl font-bold">Setup</h2>
              <label className="mt-4 block text-sm font-bold" htmlFor="start-date">
                Start date
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#c9beac] bg-white px-3 text-sm font-semibold"
                id="start-date"
                onChange={(event) => updateStartDate(event.target.value)}
                type="date"
                value={state.startDate}
              />
              <button className="mt-4 h-11 w-full rounded-md bg-[#b94b3d] px-4 text-sm font-bold text-white" onClick={resetTracker}>
                Restart at today
              </button>
            </section>
          </aside>
        </div>

        <section className="rounded-lg border border-[#d8d0c2] bg-white p-4 shadow-sm sm:p-5">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-xl font-bold">75-Day Board</h2>
              <p className="text-sm text-[#625746]">Tap any square to review or update that day.</p>
            </div>
            <p className="text-sm font-bold text-[#2f6f66]">{completedDays} complete</p>
          </div>
          <div className="board-grid mt-4">
            {Array.from({ length: TOTAL_DAYS }, (_, index) => {
              const date = addDays(state.startDate, index);
              const complete = isComplete(state.records[date]);
              const isSelected = date === selectedDate;
              const isPastToday = diffDays(state.startDate, date) < currentDay;
              return (
                <button
                  aria-label={`Day ${index + 1}`}
                  className={`day-cell ${complete ? "day-cell-complete" : ""} ${isSelected ? "day-cell-selected" : ""} ${isPastToday && !complete ? "day-cell-missed" : ""}`}
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  type="button"
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>
      </section>
    </main>
  );
}
