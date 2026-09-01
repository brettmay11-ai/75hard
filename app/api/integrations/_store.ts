import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type IntegrationName = "oura" | "strava";
export type IntegrationRecord = { accessToken: string; refreshToken?: string; expiresAt?: number; connectedAt: string };
export type IntegrationStore = Partial<Record<IntegrationName, IntegrationRecord>>;

const storePath = path.join(process.cwd(), "data", "integrations.json");

export async function readIntegrations(): Promise<IntegrationStore> {
  try { return JSON.parse(await readFile(storePath, "utf8")) as IntegrationStore; } catch { return {}; }
}

export async function writeIntegrations(store: IntegrationStore) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export function appUrl(request: Request) {
  return (process.env.APP_URL || new URL(request.url).origin).replace(/\/$/, "");
}

export function ouraRedirectUri(request: Request) {
  return process.env.OURA_REDIRECT_URI || `${appUrl(request)}/api/integrations/oura/callback`;
}
