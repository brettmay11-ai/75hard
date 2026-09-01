import { appUrl } from "../../_store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  if (!clientId) return Response.json({ error: "STRAVA_CLIENT_ID is not configured" }, { status: 503 });
  const callback = `${appUrl(request)}/api/integrations/strava/callback`;
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", "read,activity:read_all");
  return Response.redirect(url);
}
