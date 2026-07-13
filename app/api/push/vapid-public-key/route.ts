export const runtime = "nodejs";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) {
    return Response.json({ error: "VAPID_PUBLIC_KEY is not configured" }, { status: 503 });
  }

  return Response.json({ publicKey: key });
}
