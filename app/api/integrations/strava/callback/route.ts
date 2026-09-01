import { appUrl, readIntegrations, writeIntegrations } from "../../_store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${appUrl(request)}/?integration_error=strava`);
  const response = await fetch("https://www.strava.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ client_id: process.env.STRAVA_CLIENT_ID || "", client_secret: process.env.STRAVA_CLIENT_SECRET || "", code, grant_type: "authorization_code" }),
  });
  if (!response.ok) return Response.redirect(`${appUrl(request)}/?integration_error=strava`);
  const tokens = (await response.json()) as { access_token: string; refresh_token?: string; expires_at?: number };
  const store = await readIntegrations();
  store.strava = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: (tokens.expires_at || 0) * 1000, connectedAt: new Date().toISOString() };
  await writeIntegrations(store);
  return Response.redirect(`${appUrl(request)}/?connected=strava`);
}
