"use client";

import { type CSSProperties, type TouchEvent, useEffect, useMemo, useRef, useState } from "react";

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

type ReminderSettings = {
  enabled: boolean;
  intervalMinutes: number;
  startTime: string;
  endTime: string;
};

type WorkoutReminderSettings = {
  enabled: boolean;
  workoutOneTime: string;
  workoutTwoTime: string;
};

type SelectedPhoto = {
  date: string;
  file: File;
  url: string;
};

type AppView = "dashboard" | "settings";

const TASKS = [
  { key: "diet", label: "Diet followed", detail: "No cheats, no alcohol" },
  { key: "workoutIndoor", label: "Workout 1", detail: "45 minutes" },
  { key: "workoutOutdoor", label: "Workout 2 outdoors", detail: "45 minutes outside" },
  { key: "water", label: "Water", detail: "1 gallon" },
  { key: "reading", label: "Read", detail: "10 pages" },
  { key: "photo", label: "Progress photo", detail: "Daily check-in" },
] as const;

const STORAGE_KEY = "personal-75-hard-tracker";
const REMINDER_KEY = "personal-75-hard-reminders";
const WORKOUT_REMINDER_KEY = "personal-75-hard-workout-reminders";
const LAST_WATER_REMINDER_KEY = "personal-75-hard-last-water-reminder";
const LAST_WORKOUT_REMINDER_KEY = "personal-75-hard-last-workout-reminder";
const TOTAL_DAYS = 75;
const DEFAULT_REMINDERS: ReminderSettings = {
  enabled: false,
  intervalMinutes: 90,
  startTime: "08:00",
  endTime: "20:00",
};
const DEFAULT_WORKOUT_REMINDERS: WorkoutReminderSettings = {
  enabled: false,
  workoutOneTime: "07:00",
  workoutTwoTime: "17:30",
};
const WORKOUT_ROTATION = [
  {
    title: "Push",
    workoutOne: "Chest, shoulders, and triceps strength.",
    workoutTwo: "Outdoor walk, ruck, or easy zone-2 cardio.",
  },
  {
    title: "Pull",
    workoutOne: "Back, biceps, rear delts, and grip strength.",
    workoutTwo: "Outdoor walk, incline walk, or light jog.",
  },
  {
    title: "Run",
    workoutOne: "Easy run, intervals, or tempo work.",
    workoutTwo: "Outdoor recovery walk or mobility walk.",
  },
  {
    title: "Legs",
    workoutOne: "Quads, hamstrings, glutes, and calves.",
    workoutTwo: "Outdoor walk or easy bike if your legs need mercy.",
  },
  {
    title: "Core",
    workoutOne: "Core, carries, mobility, and stability work.",
    workoutTwo: "Outdoor walk, hike, or easy jog.",
  },
  {
    title: "Run",
    workoutOne: "Steady outdoor run or run/walk intervals.",
    workoutTwo: "Mobility, stretching, or a light recovery walk.",
  },
  {
    title: "Full Body",
    workoutOne: "Full-body circuit or upper/lower mix.",
    workoutTwo: "Outdoor walk, hike, or relaxed cardio.",
  },
];
const CELEBRATION_BITS = Array.from({ length: 24 }, (_, index) => index);

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

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function isWithinReminderWindow(settings: ReminderSettings, date: Date) {
  const now = date.getHours() * 60 + date.getMinutes();
  const start = timeToMinutes(settings.startTime);
  const end = timeToMinutes(settings.endTime);

  if (start <= end) {
    return now >= start && now <= end;
  }

  return now >= start || now <= end;
}

function isWorkoutReminderDue(time: string, date: Date) {
  const now = date.getHours() * 60 + date.getMinutes();
  const scheduled = timeToMinutes(time);
  return now >= scheduled && now < scheduled + 60;
}

function getWorkoutPlan(startDate: string, dateString: string) {
  const dayIndex = Math.max(diffDays(startDate, dateString) - 1, 0);
  return WORKOUT_ROTATION[dayIndex % WORKOUT_ROTATION.length];
}

export default function Home() {
  const today = toDateInput(new Date());
  const photoInputRef = useRef<HTMLInputElement>(null);
  const refreshStartYRef = useRef<number | null>(null);
  const refreshDistanceRef = useRef(0);
  const [state, setState] = useState<TrackerState>({
    startDate: today,
    records: { [today]: createRecord(today) },
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [loaded, setLoaded] = useState(false);
  const [reminders, setReminders] = useState<ReminderSettings>(DEFAULT_REMINDERS);
  const [workoutReminders, setWorkoutReminders] =
    useState<WorkoutReminderSettings>(DEFAULT_WORKOUT_REMINDERS);
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission>("default");
  const [celebrationDay, setCelebrationDay] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<AppView>("dashboard");
  const [selectedPhoto, setSelectedPhoto] = useState<SelectedPhoto | null>(null);
  const [refreshDistance, setRefreshDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

    const savedReminders = window.localStorage.getItem(REMINDER_KEY);
    if (savedReminders) {
      try {
        setReminders({ ...DEFAULT_REMINDERS, ...JSON.parse(savedReminders) });
      } catch {
        window.localStorage.removeItem(REMINDER_KEY);
      }
    }

    const savedWorkoutReminders = window.localStorage.getItem(WORKOUT_REMINDER_KEY);
    if (savedWorkoutReminders) {
      try {
        setWorkoutReminders({
          ...DEFAULT_WORKOUT_REMINDERS,
          ...JSON.parse(savedWorkoutReminders),
        });
      } catch {
        window.localStorage.removeItem(WORKOUT_REMINDER_KEY);
      }
    }

    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }

    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }

    setLoaded(true);
  }, [today]);

  useEffect(() => {
    if (loaded) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      window.localStorage.setItem(REMINDER_KEY, JSON.stringify(reminders));
      window.localStorage.setItem(WORKOUT_REMINDER_KEY, JSON.stringify(workoutReminders));
    }
  }, [loaded, reminders, state, workoutReminders]);

  useEffect(() => {
    if (!loaded || !reminders.enabled || notificationPermission !== "granted") {
      return;
    }

    const checkWaterReminder = () => {
      const now = new Date();
      const todayRecord = state.records[today];

      if (todayRecord?.water || !isWithinReminderWindow(reminders, now)) {
        return;
      }

      const lastReminder = window.localStorage.getItem(LAST_WATER_REMINDER_KEY);
      const intervalMs = reminders.intervalMinutes * 60 * 1000;

      if (lastReminder && now.getTime() - Number(lastReminder) < intervalMs) {
        return;
      }

      window.localStorage.setItem(LAST_WATER_REMINDER_KEY, String(now.getTime()));
      void showWaterNotification();
    };

    checkWaterReminder();
    const timer = window.setInterval(checkWaterReminder, 60000);
    return () => window.clearInterval(timer);
  }, [loaded, notificationPermission, reminders, state.records, today]);

  useEffect(() => {
    if (!loaded || !workoutReminders.enabled || notificationPermission !== "granted") {
      return;
    }

    const checkWorkoutReminders = () => {
      const now = new Date();
      const todayRecord = state.records[today];
      const sentKey = `${today}:${workoutReminders.workoutOneTime}:${workoutReminders.workoutTwoTime}`;
      const sent = JSON.parse(window.localStorage.getItem(LAST_WORKOUT_REMINDER_KEY) || "{}") as Record<
        string,
        boolean
      >;

      if (
        !todayRecord?.workoutIndoor &&
        !sent[`${sentKey}:one`] &&
        isWorkoutReminderDue(workoutReminders.workoutOneTime, now)
      ) {
        sent[`${sentKey}:one`] = true;
        window.localStorage.setItem(LAST_WORKOUT_REMINDER_KEY, JSON.stringify(sent));
        void showWorkoutNotification("one");
      }

      if (
        !todayRecord?.workoutOutdoor &&
        !sent[`${sentKey}:two`] &&
        isWorkoutReminderDue(workoutReminders.workoutTwoTime, now)
      ) {
        sent[`${sentKey}:two`] = true;
        window.localStorage.setItem(LAST_WORKOUT_REMINDER_KEY, JSON.stringify(sent));
        void showWorkoutNotification("two");
      }
    };

    checkWorkoutReminders();
    const timer = window.setInterval(checkWorkoutReminders, 60000);
    return () => window.clearInterval(timer);
  }, [loaded, notificationPermission, state.records, today, workoutReminders]);

  useEffect(() => {
    if (!celebrationDay) {
      return;
    }

    const timer = window.setTimeout(() => setCelebrationDay(null), 2200);
    return () => window.clearTimeout(timer);
  }, [celebrationDay]);

  useEffect(() => {
    return () => {
      if (selectedPhoto) {
        URL.revokeObjectURL(selectedPhoto.url);
      }
    };
  }, [selectedPhoto]);

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
  const selectedWorkoutPlan = getWorkoutPlan(state.startDate, selectedDate);

  function updateRecord(nextRecord: DayRecord) {
    setState((previous) => ({
      ...previous,
      records: {
        ...previous.records,
        [nextRecord.date]: nextRecord,
      },
    }));

    if (!isComplete(state.records[nextRecord.date]) && isComplete(nextRecord)) {
      setCelebrationDay(nextRecord.date);
    }
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

  function openPhotoCapture() {
    photoInputRef.current?.click();
  }

  function rememberPhoto(file: File) {
    setSelectedPhoto((previous) => {
      if (previous) {
        URL.revokeObjectURL(previous.url);
      }

      return {
        date: selectedDate,
        file,
        url: URL.createObjectURL(file),
      };
    });
    updateRecord({ ...selectedRecord, photo: true });
  }

  async function saveSelectedPhoto() {
    if (!selectedPhoto) {
      return;
    }

    const filename = `75-hard-${selectedPhoto.date}.jpg`;
    const shareData = {
      files: [new File([selectedPhoto.file], filename, { type: selectedPhoto.file.type })],
      title: "75 Hard Progress Photo",
      text: `Progress photo for ${selectedPhoto.date}`,
    };

    if (navigator.canShare?.(shareData)) {
      await navigator.share(shareData);
      return;
    }

    const link = document.createElement("a");
    link.href = selectedPhoto.url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  async function showWaterNotification() {
    const title = "Drink water";
    const body = "Quick 75 Hard check-in: get some water in before the day gets away.";

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        badge: "/favicon.svg",
        icon: "/favicon.svg",
        tag: "water-reminder",
      });
      return;
    }

    new Notification(title, { body, tag: "water-reminder" });
  }

  async function showWorkoutNotification(slot: "one" | "two") {
    const plan = getWorkoutPlan(state.startDate, today);
    const isFirstWorkout = slot === "one";
    const title = isFirstWorkout ? `Workout 1: ${plan.title}` : `Outdoor workout: ${plan.title}`;
    const body = isFirstWorkout ? plan.workoutOne : plan.workoutTwo;

    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title, {
        body,
        badge: "/favicon.svg",
        icon: "/favicon.svg",
        tag: `workout-reminder-${slot}`,
      });
      return;
    }

    new Notification(title, { body, tag: `workout-reminder-${slot}` });
  }

  async function enableReminders() {
    if (!("Notification" in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setReminders((current) => ({ ...current, enabled: true }));
      await showWaterNotification();
    }
  }

  async function testReminder() {
    if (notificationPermission === "granted") {
      await showWaterNotification();
      return;
    }

    await enableReminders();
  }

  async function enableWorkoutReminders() {
    if (!("Notification" in window)) {
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === "granted") {
      setWorkoutReminders((current) => ({ ...current, enabled: true }));
      await showWorkoutNotification("one");
    }
  }

  async function testWorkoutReminder() {
    if (notificationPermission === "granted") {
      await showWorkoutNotification("one");
      return;
    }

    await enableWorkoutReminders();
  }

  function handleRefreshStart(event: TouchEvent<HTMLElement>) {
    if (window.scrollY <= 0) {
      refreshStartYRef.current = event.touches[0].clientY;
    }
  }

  function handleRefreshMove(event: TouchEvent<HTMLElement>) {
    if (refreshStartYRef.current === null || isRefreshing) {
      return;
    }

    const distance = event.touches[0].clientY - refreshStartYRef.current;

    if (distance <= 0) {
      refreshDistanceRef.current = 0;
      setRefreshDistance(0);
      return;
    }

    const nextDistance = Math.min(distance * 0.48, 96);
    refreshDistanceRef.current = nextDistance;
    setRefreshDistance(nextDistance);
  }

  function handleRefreshEnd() {
    refreshStartYRef.current = null;

    if (refreshDistanceRef.current >= 72) {
      setIsRefreshing(true);
      window.setTimeout(() => window.location.reload(), 180);
      return;
    }

    refreshDistanceRef.current = 0;
    setRefreshDistance(0);
  }

  return (
    <main
      className="min-h-screen bg-[#f5f2eb] text-[#171512]"
      onTouchCancel={handleRefreshEnd}
      onTouchEnd={handleRefreshEnd}
      onTouchMove={handleRefreshMove}
      onTouchStart={handleRefreshStart}
    >
      <div
        aria-hidden={refreshDistance === 0 && !isRefreshing}
        className={`pull-refresh ${refreshDistance >= 72 || isRefreshing ? "pull-refresh-ready" : ""}`}
        style={{ transform: `translate(-50%, ${Math.max(refreshDistance - 64, -64)}px)` }}
      >
        {isRefreshing ? "Refreshing..." : refreshDistance >= 72 ? "Release to refresh" : "Pull to refresh"}
      </div>
      {celebrationDay && (
        <div aria-live="polite" className="celebration" role="status">
          <div className="celebration-burst" />
          <div className="celebration-card">
            <span className="celebration-kicker">Day locked in</span>
            <strong>Complete</strong>
            <small>{celebrationDay}</small>
          </div>
          {CELEBRATION_BITS.map((bit) => (
            <span className="celebration-bit" key={bit} style={{ "--bit": bit } as CSSProperties} />
          ))}
        </div>
      )}
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
          <div className="grid gap-3 sm:min-w-[360px]">
            <nav aria-label="App sections" className="view-switch">
              <button
                aria-pressed={activeView === "dashboard"}
                className={activeView === "dashboard" ? "view-switch-active" : ""}
                onClick={() => setActiveView("dashboard")}
                type="button"
              >
                Dashboard
              </button>
              <button
                aria-pressed={activeView === "settings"}
                className={activeView === "settings" ? "view-switch-active" : ""}
                onClick={() => setActiveView("settings")}
                type="button"
              >
                Settings
              </button>
            </nav>
            <div className="grid grid-cols-3 gap-2 text-center">
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
          </div>
        </header>

        {activeView === "dashboard" ? (
          <>
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
              {TASKS.map((task) => {
                if (task.key === "photo") {
                  return (
                    <button
                      className={`task-row text-left ${selectedRecord.photo ? "task-row-complete" : ""}`}
                      key={task.key}
                      onClick={openPhotoCapture}
                      type="button"
                    >
                      <span
                        aria-hidden="true"
                        className={`photo-check ${selectedRecord.photo ? "photo-check-complete" : ""}`}
                      />
                      <span>
                        <strong>{task.label}</strong>
                        <small>
                          {selectedRecord.photo ? "Photo selected for today" : "Tap to open camera"}
                        </small>
                      </span>
                    </button>
                  );
                }

                return (
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
                );
              })}
              <input
                accept="image/*"
                aria-label="Take progress photo"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    rememberPhoto(file);
                    event.target.value = "";
                  }
                }}
                ref={photoInputRef}
                type="file"
              />
            </div>

            {selectedPhoto?.date === selectedDate && (
              <div className="photo-save-panel">
                <img alt="Selected progress preview" src={selectedPhoto.url} />
                <div>
                  <strong>Progress photo ready</strong>
                  <p>Use your phone&apos;s save/share options to keep a copy outside the tracker.</p>
                  <button onClick={() => void saveSelectedPhoto()} type="button">
                    Save photo
                  </button>
                </div>
              </div>
            )}

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
              <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#7c6b55]">
                Workout Focus
              </p>
              <h2 className="mt-2 text-2xl font-black">{selectedWorkoutPlan.title}</h2>
              <div className="mt-4 grid gap-3 text-sm text-[#625746]">
                <p>
                  <strong className="text-[#171512]">Workout 1:</strong>{" "}
                  {selectedWorkoutPlan.workoutOne}
                </p>
                <p>
                  <strong className="text-[#171512]">Outdoor:</strong>{" "}
                  {selectedWorkoutPlan.workoutTwo}
                </p>
              </div>
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
          </>
        ) : (
          <section className="settings-grid">
            <div className="settings-panel">
              <h2>Setup</h2>
              <p>Adjust the challenge start date or restart the tracker from today.</p>

              <label className="mt-5 block text-sm font-bold" htmlFor="start-date">
                Start date
              </label>
              <input
                className="mt-2 h-11 w-full rounded-md border border-[#c9beac] bg-white px-3 text-sm font-semibold"
                id="start-date"
                onChange={(event) => updateStartDate(event.target.value)}
                type="date"
                value={state.startDate}
              />

              <button
                className="mt-4 h-11 w-full rounded-md bg-[#b94b3d] px-4 text-sm font-bold text-white"
                onClick={resetTracker}
                type="button"
              >
                Restart at today
              </button>
            </div>

            <div className="settings-panel">
              <h2>Water Reminders</h2>
              <p>Sends device notifications until today&apos;s water box is checked.</p>

              <div className="mt-5 grid gap-3">
                <button
                  className={`h-11 rounded-md px-4 text-sm font-bold text-white ${
                    reminders.enabled ? "bg-[#2f6f66]" : "bg-[#171512]"
                  }`}
                  onClick={() => {
                    if (notificationPermission === "granted") {
                      setReminders((current) => ({ ...current, enabled: !current.enabled }));
                    } else {
                      void enableReminders();
                    }
                  }}
                  type="button"
                >
                  {reminders.enabled ? "Reminders on" : "Enable reminders"}
                </button>

                <label className="grid gap-2 text-sm font-bold" htmlFor="interval">
                  Remind every
                  <select
                    className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm"
                    id="interval"
                    onChange={(event) =>
                      setReminders((current) => ({
                        ...current,
                        intervalMinutes: Number(event.target.value),
                      }))
                    }
                    value={reminders.intervalMinutes}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={60}>1 hour</option>
                    <option value={90}>90 minutes</option>
                    <option value={120}>2 hours</option>
                  </select>
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-bold" htmlFor="start-time">
                    Start
                    <input
                      className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm"
                      id="start-time"
                      onChange={(event) =>
                        setReminders((current) => ({ ...current, startTime: event.target.value }))
                      }
                      type="time"
                      value={reminders.startTime}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold" htmlFor="end-time">
                    End
                    <input
                      className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm"
                      id="end-time"
                      onChange={(event) =>
                        setReminders((current) => ({ ...current, endTime: event.target.value }))
                      }
                      type="time"
                      value={reminders.endTime}
                    />
                  </label>
                </div>

                <button
                  className="h-11 rounded-md border border-[#c9beac] bg-white px-4 text-sm font-bold"
                  onClick={() => void testReminder()}
                  type="button"
                >
                  Send test
                </button>

                <p className="text-xs font-semibold text-[#625746]">
                  Status: {notificationPermission}
                </p>
              </div>
            </div>

            <div className="settings-panel">
              <h2>Workout Reminders</h2>
              <p>
                Uses a 7-day rotation: Push, Pull, Run, Legs, Core, Run, Full Body.
              </p>

              <div className="mt-5 grid gap-3">
                <button
                  className={`h-11 rounded-md px-4 text-sm font-bold text-white ${
                    workoutReminders.enabled ? "bg-[#2f6f66]" : "bg-[#171512]"
                  }`}
                  onClick={() => {
                    if (notificationPermission === "granted") {
                      setWorkoutReminders((current) => ({
                        ...current,
                        enabled: !current.enabled,
                      }));
                    } else {
                      void enableWorkoutReminders();
                    }
                  }}
                  type="button"
                >
                  {workoutReminders.enabled ? "Workout reminders on" : "Enable workout reminders"}
                </button>

                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-bold" htmlFor="workout-one-time">
                    Workout 1
                    <input
                      className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm"
                      id="workout-one-time"
                      onChange={(event) =>
                        setWorkoutReminders((current) => ({
                          ...current,
                          workoutOneTime: event.target.value,
                        }))
                      }
                      type="time"
                      value={workoutReminders.workoutOneTime}
                    />
                  </label>
                  <label className="grid gap-2 text-sm font-bold" htmlFor="workout-two-time">
                    Outdoor
                    <input
                      className="h-11 rounded-md border border-[#c9beac] bg-white px-3 text-sm"
                      id="workout-two-time"
                      onChange={(event) =>
                        setWorkoutReminders((current) => ({
                          ...current,
                          workoutTwoTime: event.target.value,
                        }))
                      }
                      type="time"
                      value={workoutReminders.workoutTwoTime}
                    />
                  </label>
                </div>

                <button
                  className="h-11 rounded-md border border-[#c9beac] bg-white px-4 text-sm font-bold"
                  onClick={() => void testWorkoutReminder()}
                  type="button"
                >
                  Send workout test
                </button>

                <div className="rounded-md border border-[#d8d0c2] bg-white p-3 text-sm text-[#625746]">
                  <strong className="text-[#171512]">Today:</strong> {getWorkoutPlan(state.startDate, today).title}
                </div>
              </div>
            </div>
          </section>
        )}
      </section>
    </main>
  );
}
