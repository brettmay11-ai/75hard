# Well / Being

A private, mobile-first wellness app that turns Oura recovery data and daily check-ins into a practical training, recovery, and food prescription.

Daily check-ins are stored in the browser on the device. Oura is read-only and supplies readiness, sleep score, activity, steps, and recent workouts.

OAuth callback URLs:

- Oura: `https://YOUR-DOMAIN/api/integrations/oura/callback`
- Strava: `https://YOUR-DOMAIN/api/integrations/strava/callback`

## What It Includes

- Oura-powered wellness score and daily prescription
- Specific movements with sets, reps, running, stretching, and recovery
- Food focus that adapts to recovery and training demand
- Editable time, equipment, and personal readiness override
- Daily anchors, hydration, reflections, trends, and history
- Local data export and deletion controls
- Mobile pull-to-refresh and home-screen friendly layout

The Oura OAuth routes require `APP_URL`, `OURA_CLIENT_ID`, `OURA_CLIENT_SECRET`, and `OURA_REDIRECT_URI` in the hosted environment.

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
