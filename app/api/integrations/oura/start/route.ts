import { appUrl } from "../../_store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const clientId = process.env.OURA_CLIENT_ID;
  if (!clientId) return Response.json({ error: "OURA_CLIENT_ID is not configured" }, { status: 503 });
  const callback = `${appUrl(request)}/api/integrations/oura/callback`;
  const url = new URL("https://cloud.ouraring.com/oauth/authorize");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", callback);
  url.searchParams.set("scope", "daily workout heartrate");
  return Response.redirect(url);
}
