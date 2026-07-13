import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type PushSubscriptionRecord = {
  subscription: PushSubscriptionJSON;
  reminders?: unknown;
  workoutReminders?: unknown;
  workoutPlans?: unknown;
  startDate?: string;
  timeZone?: string;
  records?: Record<string, { water?: boolean; workoutIndoor?: boolean; workoutOutdoor?: boolean }>;
  sent?: Record<string, number>;
};

const storePath = path.join(process.cwd(), "data", "push-subscriptions.json");

export async function readSubscriptions() {
  try {
    return JSON.parse(await readFile(storePath, "utf8")) as PushSubscriptionRecord[];
  } catch {
    return [];
  }
}

export async function writeSubscriptions(records: PushSubscriptionRecord[]) {
  await mkdir(path.dirname(storePath), { recursive: true });
  await writeFile(storePath, JSON.stringify(records, null, 2), "utf8");
}
