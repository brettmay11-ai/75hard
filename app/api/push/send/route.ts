import { readSubscriptions, writeSubscriptions } from "../_store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.PUSH_ADMIN_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string; message?: string; tag?: string };
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
    try {
      await webPush.sendNotification(
        record.subscription as Parameters<typeof webPush.sendNotification>[0],
        JSON.stringify({
          title: body.title || "75 Hard reminder",
          body: body.message || "Keep today moving.",
          tag: body.tag || "75-hard-reminder",
        }),
      );
      remaining.push(record);
      sent += 1;
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode !== 404 && statusCode !== 410) remaining.push(record);
    }
  }

  await writeSubscriptions(remaining);
  return Response.json({ ok: true, sent, subscriptions: remaining.length });
}
