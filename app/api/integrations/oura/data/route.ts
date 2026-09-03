import { readIntegrations, writeIntegrations } from "../../_store";

export const runtime = "nodejs";
const APP_TIME_ZONE = "America/Chicago";

function dateKey(date = new Date()) { const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: APP_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(date).map((part) => [part.type, part.value])); return `${parts.year}-${parts.month}-${parts.day}`; }

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
  const date = new URL(request.url).searchParams.get("date") || dateKey();
  const start = new Date(`${date}T12:00:00`);
  start.setDate(start.getDate() - 6);
  const startDate = dateKey(start);
  const headers = { Authorization: `Bearer ${oura.accessToken}` };
  const query = `?start_date=${startDate}&end_date=${date}`;
  const [sleepResponse, dailySleepResponse, readinessResponse, activityResponse, workoutResponse] = await Promise.all([
    fetch(`https://api.ouraring.com/v2/usercollection/sleep${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_sleep${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_readiness${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/daily_activity${query}`, { headers }),
    fetch(`https://api.ouraring.com/v2/usercollection/workout${query}`, { headers }),
  ]);
  if ([sleepResponse, dailySleepResponse, readinessResponse, activityResponse, workoutResponse].some((response) => response.status === 401)) return Response.json({ connected: false, expired: true }, { status: 401 });
  const readLatest = async (response: Response) => response.ok ? (await response.json() as { data?: Record<string, unknown>[] }).data?.at(-1) || null : null;
  const sleep = await readLatest(sleepResponse);
  const dailySleep = await readLatest(dailySleepResponse);
  const readiness = await readLatest(readinessResponse);
  const activity = await readLatest(activityResponse);
  const workouts = workoutResponse.ok ? (await workoutResponse.json() as { data?: Record<string, unknown>[] }).data || [] : [];
  return Response.json({ connected: true, date, sleep: { ...(dailySleep || {}), ...(sleep || {}) }, readiness, activity, workouts });
}
