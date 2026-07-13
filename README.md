# Personal 75 Hard Tracker

A private, local-first tracker for the 75 Hard challenge. It saves progress in the browser on your device, so there is no account, database, subscription, or paid app required.

## What It Tracks

- Diet followed
- First 45-minute workout
- Second 45-minute outdoor workout
- One gallon of water
- 10 pages of reading
- Daily progress photo
- Optional notes for each day
- 75-day visual progress board

## Run Locally

```bash
pnpm install
pnpm run dev
```

## Build Check

```bash
pnpm run build
```

## Phone Use

Open the hosted site on your phone and add it to your home screen or bookmarks. Progress is stored in that phone browser's local storage.

## Server Reminders

The Settings page can connect the phone to Web Push so reminders can arrive even when the app is closed. Railway needs `VAPID_SUBJECT`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_ADMIN_TOKEN`, and `PUSH_APP_URL` environment variables.

Generate VAPID keys with `pnpm exec web-push generate-vapid-keys`. Add a Railway Volume mounted at `/app/data` so subscriptions survive deploys. A Railway Cron Job can run `pnpm run push:send` every minute; it evaluates each device's saved water/workout times and skips tasks already completed that day.

The server sender uses the phone's time zone and stores subscription state on the Railway Volume. The older `/api/push/send` endpoint remains available for an authenticated manual broadcast.
