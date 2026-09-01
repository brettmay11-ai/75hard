import { appUrl, readIntegrations, writeIntegrations } from "../../_store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return Response.redirect(`${appUrl(request)}/?integration_error=oura`);
  const response = await fetch("https://api.ouraring.com/oauth/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: process.env.OURA_CLIENT_ID || "",
      client_secret: process.env.OURA_CLIENT_SECRET || "",
      redirect_uri: `${appUrl(request)}/api/integrations/oura/callback`,
    }),
  });
  if (!response.ok) {
    const detail = (await response.text()).toLowerCase();
    const reason = detail.includes("invalid_client") ? "invalid_client" : detail.includes("invalid_grant") ? "invalid_grant" : "token_exchange_failed";
    return Response.redirect(`${appUrl(request)}/?integration_error=oura&integration_detail=${reason}`);
  }
  const tokens = (await response.json()) as { access_token: string; refresh_token?: string; expires_in?: number };
  const store = await readIntegrations();
  store.oura = { accessToken: tokens.access_token, refreshToken: tokens.refresh_token, expiresAt: Date.now() + (tokens.expires_in || 86400) * 1000, connectedAt: new Date().toISOString() };
  await writeIntegrations(store);
  return Response.redirect(`${appUrl(request)}/?connected=oura`);
}
