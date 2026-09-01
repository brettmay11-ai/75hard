import { readIntegrations, writeIntegrations } from "../../_store";

export const runtime = "nodejs";

async function refreshIfNeeded() {
  const store = await readIntegrations();
  let oura = store.oura;
  if (!oura) return null;
  if (oura.expiresAt && oura.expiresAt > Date.now() + 300000) return oura;
  if (!oura.refreshToken) return oura;
  const response = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: oura.refreshToken, client_id: process.env.OURA_CLIENT_ID || "", client_secret: process.env.OURA_CLIENT_SECRET || "" }),
  });
  if (!response.ok) return oura;
  const tokens = await response.json() as { access_token: string; refresh_token?: string; expires_in?: number };
  oura = { ...oura, accessToken: tokens.access_token, refreshToken: tokens.refresh_token || oura.refreshToken, expiresAt: Date.now() + (tokens.expires_in || 86400) * 1000 };
  store.oura = oura;
  await writeIntegrations(store);
  return oura;
}

export async function GET(request: Request) {
  const oura = await refreshIfNeeded();
  if (!oura) return Response.json({ connected: false }, { status: 404 });
  const date = new URL(request.url).searchParams.get("date") || new Date().toISOString().slice(0, 10);
  const headers = { Authorization: `Bearer ${oura.accessToken}` };
  const query = `?start_date=${date}&end_date=${date}`;
  const [sleepResponse, readinessResponse, activityResponse] = await Promise.all([
    fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_activity${query}`, { headers }),
  ]);
  if ([sleepResponse, readinessResponse, activityResponse].some((response) => response.status === 401)) return Response.json({ connected: false, expired: true }, { status: 401 });
  const read = async (response: Response) => response.ok ? (await response.json() as { data?: Record<string, unknown>[] }).data?.[0] || null : null;
  const sleep = await read(sleepResponse);
  const readiness = await read(readinessResponse);
  const activity = await read(activityResponse);
  return Response.json({ connected: true, date, sleep, readiness, activity });
}
