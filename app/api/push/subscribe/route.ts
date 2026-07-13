import { readSubscriptions, writeSubscriptions, type PushSubscriptionRecord } from "../_store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as PushSubscriptionRecord;
  if (!body?.subscription?.endpoint) {
    return Response.json({ error: "A push subscription is required" }, { status: 400 });
  }

  const records = await readSubscriptions();
  const next = records.filter((item) => item.subscription.endpoint !== body.subscription.endpoint);
  next.push({ ...body, sent: body.sent || {} });
  await writeSubscriptions(next);
  return Response.json({ ok: true });
}
