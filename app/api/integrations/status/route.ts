import { readIntegrations } from "../_store";

export const runtime = "nodejs";

export async function GET() {
  const store = await readIntegrations();
  return Response.json({ oura: Boolean(store.oura), strava: Boolean(store.strava) });
}
