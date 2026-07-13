import { readSubscriptions, writeSubscriptions } from "../_store";

export const runtime = "nodejs";

function minutes(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  return hour * 60 + minute;
}

function nowFor(timeZone = "UTC") {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minute: Number(get("hour")) * 60 + Number(get("minute")) };
}

function inWindow(now: number, start: string, end: string) {
  const from = minutes(start);
  const to = minutes(end);
  return from <= to ? now >= from && now <= to : now >= from || now <= to;
}

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.PUSH_ADMIN_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const webPush = await import("web-push");
  webPush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:75hard@example.com",
    process.env.VAPID_PUBLIC_KEY || "",
    process.env.VAPID_PRIVATE_KEY || "",
  );
  const records = await readSubscriptions();
  const remaining = [];
  let sent = 0;

  for (const record of records) {
    const local = nowFor(record.timeZone);
    const day = record.records?.[local.date];
    const water = record.reminders as { enabled?: boolean; intervalMinutes?: number; startTime?: string; endTime?: string } | undefined;
    const workouts = record.workoutReminders as { enabled?: boolean; workoutOneTime?: string; workoutTwoTime?: string } | undefined;
    const sentKeys = record.sent || {};
    const due: { title: string; body: string; key: string }[] = [];

    if (water?.enabled && !day?.water && inWindow(local.minute, water.startTime || "08:00", water.endTime || "20:00")) {
      const key = `${local.date}:water`;
      const last = sentKeys[key] || 0;
      if (Date.now() - last >= (water.intervalMinutes || 90) * 60000) {
        due.push({ title: "Drink water", body: "Quick 75 Hard check-in: get some water in.", key });
      }
    }

    if (workouts?.enabled && !day?.workoutIndoor && local.minute >= minutes(workouts.workoutOneTime || "07:00") && local.minute < minutes(workouts.workoutOneTime || "07:00") + 60) {
      const key = `${local.date}:workout-one`;
      if (!sentKeys[key]) due.push({ title: "Workout 1", body: "Your scheduled first workout is ready.", key });
    }

    if (workouts?.enabled && !day?.workoutOutdoor && local.minute >= minutes(workouts.workoutTwoTime || "17:30") && local.minute < minutes(workouts.workoutTwoTime || "17:30") + 60) {
      const key = `${local.date}:workout-two`;
      if (!sentKeys[key]) due.push({ title: "Outdoor workout", body: "Get outside for your second 45-minute workout.", key });
    }

    try {
      for (const notification of due) {
        await webPush.sendNotification(
          record.subscription as Parameters<typeof webPush.sendNotification>[0],
          JSON.stringify({ title: notification.title, body: notification.body, tag: notification.key }),
        );
        sentKeys[notification.key] = Date.now();
        sent += 1;
      }
      remaining.push({ ...record, sent: sentKeys });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404 && statusCode !== 410) remaining.push(record);
    }
  }

  await writeSubscriptions(remaining);
  return Response.json({ ok: true, sent });
}
