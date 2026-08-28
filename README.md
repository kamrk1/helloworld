# Clinic Admin — multi-tenant product

Calendar-first clinic admin (replaces the old Google Apps Script + Sheets CRM). **Phone and desktop are clients of the same hosted app.** The live source of truth is the **cloud database** (Prisma Postgres). Each device can install the app as a **PWA** and paints the last saved week instantly from a local cache. Writes go to the cloud when you are online.

The first customer is **Shree Datta Dental Care** (`clinicId` **`sdc`**): Asia/Kolkata, 10:00–20:00, Sunday closed, 30-minute slots. Additional clinics are separate tenants with their own slug, password, hours, and feature package.

## Selling to multiple clinics

The tenant key is a stable slug **`clinicId`** (for example `sdc`), not a display name. Isolation is by `clinicId` on every patient, appointment, block, and prescription. Phone numbers and appointment refs are unique **per clinic**. Subdomains are not required on `workers.dev` — App Router `/c/[clinicId]` plus a session that includes `clinicId` is enough.

| Surface | URL |
|---------|-----|
| Public booking | `/c/{clinicId}` (alias `/c/{clinicId}/book`) |
| Clinic staff login (password only) | `/c/{clinicId}/login` |
| Clinic admin | `/c/{clinicId}/admin` (Settings at `/c/{clinicId}/admin/settings`) |
| Generic staff login (one APK / PWA) | `/login` — clinic ID **and** password. Remembers last clinic ID in `localStorage`. Lands on that clinic’s admin. |
| Platform operator | `/platform` (login at `/platform/login`) |

**Compatibility shims for the first customer** (`DEFAULT_CLINIC_ID`, default `sdc`):

- `/` → `/c/sdc`
- `/admin`… → `/c/sdc/admin`… (or the signed-in clinic if the session already has a `clinicId`)
- `/api/slots` and `/api/book` without a clinic id use `DEFAULT_CLINIC_ID` only. They never mix tenants.

Do **not** treat generic `/login` as an sdc-only page — Capacitor starts there so one APK serves every customer.

### Auth

- Clinic password is stored as `passwordDigest` = HMAC-SHA256(`SESSION_SECRET`, `clinic:{id}:v1:{password}`) — same strength family as the session cookie, keyed per clinic.
- Existing `ADMIN_PASSWORD` is migrated onto clinic `sdc` (hashed) on first boot. Keep the Worker secret so the backfill can run.
- Platform password is `PLATFORM_PASSWORD` (demo default `platform-demo` if unset). Set a real secret in production: `npx wrangler secret put PLATFORM_PASSWORD`.
- Session cookie `sdc_session` is path `/` and payload `{ role: "clinic", clinicId }` or `{ role: "platform" }`. Editing the URL cannot hop clinics; admin APIs use the session clinic only.

### What clinic staff can edit (Settings)

Name, logo (bytes in Postgres, served at `/api/clinics/{id}/logo`), hours, slot size, default duration, contact, brand colors, services, Rx letterhead.

**Feature flags are not staff-editable.** The seller sets them from `/platform` when creating or patching a clinic: `publicBooking`, `pendingApproval`, `followUps`, `closures`, `prescriptions`, `whatsapp`. Flags live in JSON (`flagsJson`); adding a new flag later is a key + default in code, not a migration.

### Create a clinic

1. Sign in at `/platform/login`.
2. Create slug, name, password, hours, default duration, and flags.
3. Give the clinic `/c/{slug}/login` (or the generic `/login` + clinic ID) and `/c/{slug}` for public booking.

Demo tenant used in verification: **`demo2`** (password `Demo2-Aug2026`), 09:00–17:00, 15-minute default, prescriptions off.

## How data works

| Layer | Role |
|-------|------|
| Hosted Postgres (`DATABASE_URL` on the Worker) | Live clinic database. Bookings from any phone or desktop land here. |
| Installed PWA / browser | Client. Calendar opens from the last snapshot in `localStorage`, then refreshes from the cloud. |
| Local SQLite (`file:./clinic.db`) | Laptop-only fallback so `npm run dev` works with **no cloud credentials**. Not used in production. |

Do not treat two laptops’ SQLite files as replicas. Production and the installed app always talk to the hosted DB. If you are offline, the last week still shows; saving an appointment **fails clearly** until you reconnect (nothing is written to a private on-device database).

A daily backup of the **cloud** database is optional (Prisma Postgres / Neon backups, or `npm run backup` on a machine that has `DATABASE_URL` pointed at the cloud).

## Quick start (laptop, SQLite)

```bash
npm install
cp .env.example .env          # DATABASE_URL is already file:./clinic.db
# set ADMIN_PASSWORD in .env.local if you want something other than changeme
npm run dev
```

`npm run dev` creates `.env` from the example if it is missing, generates Prisma clients, migrates **SQLite**, and seeds sample data when the database is empty. No Postgres URL required.

Open:

- Public booking (sdc shim): [http://localhost:3000](http://localhost:3000) → `/c/sdc`
- Generic staff login: [http://localhost:3000/login](http://localhost:3000/login)
- SDC admin: [http://localhost:3000/c/sdc/admin](http://localhost:3000/c/sdc/admin)
- Platform: [http://localhost:3000/platform](http://localhost:3000/platform)

Default local clinic password from `.env.example` is `changeme` (clinic `sdc`). Platform demo password is `platform-demo`. The SQLite file is created next to the Prisma schema (`prisma/clinic.db`).

To point the same laptop at the live cloud DB instead, put the Postgres URL in `.env.local` as `DATABASE_URL`. Then `npm run dev` migrates and uses Postgres — the same database the public site uses.

## Install as a PWA (phone and desktop)

The production site is installable. After you deploy:

**Android / Chrome / Edge (desktop or mobile)**

1. Open the hosted URL and sign in at `/login`.
2. Browser menu → **Install app** / **Add to Home Screen**, or use the install banner in the admin sidebar.
3. The icon opens generic `/login` (`start_url`). After sign-in you land on that clinic’s admin.

**iPhone / iPad (Safari)**

1. Open the hosted URL in Safari (not Chrome in-app).
2. Tap Share → **Add to Home Screen**.
3. Open **SDC Clinic** from the home screen.

The calendar uses a **day** grid on a phone-sized viewport and **week** on desktop. You can still switch Week / Day. Drag, tap-to-book, and long-press work in the installed app.

While offline, the last snapshot still paints. Creating or moving an appointment requires a network connection so every device stays on the same cloud copy.

## Android (Capacitor)

The Android app is a **WebView shell** around the same live Worker. It is **Clinic Admin**, not public booking. Phone and desktop share the hosted Postgres database; the APK does not ship a second offline database.

- App name: **SDC Clinic**
- Application id: `care.shreedatta.clinic`
- Start URL: `https://proud-truth-84df.kamrk1.workers.dev/login` (generic clinic ID + password; one APK for every customer)

The launcher opens **staff login**, not a single clinic and not public booking. After sign-in the session cookie routes the WebView to `/c/{clinicId}/admin`. `allowNavigation` stays this origin so branded `/c/…` paths still work. Do not bake only `sdc` into the APK.

```bash
npm install
npx cap sync android
```

Then open the project in Android Studio (`npm run cap:android`) and run on a device/emulator, or:

```bash
cd android
./gradlew assembleDebug
```

The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk` (gitignored). You need the Android SDK (`ANDROID_HOME`) and Java 21. After changing `capacitor.config.ts` or files in `www/`, run `npx cap sync android` again.

If the clinic host is down, the WebView shows `www/error.html` instead of a blank screen. `allowNavigation` is limited to `proud-truth-84df.kamrk1.workers.dev` so the `/login` redirect still works.

## Hosting (Cloudflare Workers)

Production target: **https://proud-truth-84df.kamrk1.workers.dev** — Cloudflare Worker named `proud-truth-84df` (OpenNext, Next.js Node runtime via `nodejs_compat`). Public booking is `/c/{clinicId}` (`/` still redirects to `/c/sdc`). Generic `/login` is clinic ID + password. The PWA `start_url` is `/login`.

Cloudflare Workers Builds is connected; first production deploy is triggered by this commit.

`@opennextjs/cloudflare` is pinned to **1.15.1** — the last adapter release that still declares a Next.js `^14.2.35` peer. `@latest` (1.20+) requires Next 15.5+/16 and would force a framework upgrade.

Cloudflare Workers cannot open a raw Prisma query-engine TCP socket the way a Node host can. This app keeps the **same Prisma Postgres schema and seed** and talks to Postgres through `@prisma/adapter-pg` + `pg` (driver adapters). Do not rewrite the database to D1.

```bash
npm install
cp .dev.vars.example .dev.vars   # for npm run preview only; gitignored
# put the real Postgres URL, ADMIN_PASSWORD, SESSION_SECRET in .dev.vars

npx wrangler login               # once, in a browser
npx wrangler secret put DATABASE_URL      # existing Prisma Postgres URL
npx wrangler secret put ADMIN_PASSWORD    # migrated onto clinic sdc
npx wrangler secret put SESSION_SECRET
npx wrangler secret put PLATFORM_PASSWORD

npm run deploy                   # OpenNext build + wrangler deploy to proud-truth-84df
```

That deploy overwrites the Hello World worker at **https://proud-truth-84df.kamrk1.workers.dev**.

`npm run preview` builds the Worker and serves it locally in workerd (not `next dev`). Keep using `npm run dev` + SQLite for day-to-day UI work.

### Cloudflare secrets / vars

| Name | Kind | Required | Notes |
|------|------|----------|--------|
| `DATABASE_URL` | secret | yes | Existing Prisma Postgres URL (`postgresql://…@db.prisma.io:5432/postgres?sslmode=require`). Same database as before. |
| `ADMIN_PASSWORD` | secret | yes | Migrated onto clinic `sdc` as `passwordDigest`. Keep for the backfill. |
| `PLATFORM_PASSWORD` | secret | yes in production | `/platform` operator password. Demo default `platform-demo` if unset. |
| `SESSION_SECRET` | secret | yes | HMAC for the session cookie **and** clinic password digests |
| `DEFAULT_CLINIC_ID` | var / env | no | Compatibility shims (`/`, `/admin`, `/api/slots`) use `sdc` |
| `NEXTJS_ENV` | var (`wrangler.jsonc`) | no | Defaults to `production` |
| `NEXT_PUBLIC_CLINIC_PHONE` | build env | no | Inlined at `next build`. Set in `.env` / `.env.local` before deploy. |
| `NEXT_PUBLIC_CLINIC_ADDRESS` | build env | no | Same |
| `NEXT_PUBLIC_REVIEW_URL` | build env | no | Same |

If `pg` cannot reach Prisma Postgres from the Worker isolate (TCP/ssl), the next step is Cloudflare **Hyperdrive** in front of the same URL (`wrangler hyperdrive create` + a `hyperdrive` binding). Prisma Accelerate (`prisma://` HTTP) is another option. D1 is last resort and would drop this schema.

Worker size limit is 3 MiB gzip on the free plan (10 MiB paid). If deploy fails on size, check the OpenNext output in `.open-next/`.

### Node standalone / Vercel (optional)

`npm run build:standalone` still produces a Node `output: "standalone"` build (cloudflared / a VPS). Vercel serverless **cannot** use SQLite `file://`. Set `DATABASE_URL` to Postgres plus `ADMIN_PASSWORD` and `SESSION_SECRET`. Anonymous `vercel deploy --temporary` URLs expire in about an hour unless you claim them.

### Free-tier notes

- **Prisma Postgres** (`npx create-db@latest`) — fastest path for a preview URL. Claim the database so it does not expire.
- **Neon** — serverless Postgres, generous free tier, point-in-time restore on paid; nightly backup is optional.
- **Turso** — SQLite-compatible edge DB. Not required here; production stays on Prisma Postgres so the existing schema and Vercel path keep working.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Local: `file:./clinic.db`. Production: Postgres (`postgresql://…` or `prisma+postgres://…`). |
| `ADMIN_PASSWORD` | yes | Migrated onto clinic `sdc`. Local default `changeme`. |
| `PLATFORM_PASSWORD` | no | `/platform` password. Defaults to `platform-demo` if unset. |
| `DEFAULT_CLINIC_ID` | no | Shim clinic for `/` and `/admin`. Defaults to `sdc`. |
| `SESSION_SECRET` | yes | HMAC secret for the session cookie and clinic password digests. Use a long random string in production. |
| `NEXT_PUBLIC_REVIEW_URL` | no | Shown on the appointment panel (Google review link). |
| `NEXT_PUBLIC_CLINIC_PHONE` | no | 10-digit number shown on the public page. |
| `NEXT_PUBLIC_CLINIC_ADDRESS` | no | Printed on prescriptions. |

No Google Apps Script, no `script.google.com`, no hardcoded production secrets.

## What you can do

**Calendar (default admin home)** — Google Calendar-like week/day grid:

- Drag an appointment to reschedule (persists immediately, reverts on conflict or if you are offline).
- Resize to 30 / 60 / 90 minutes.
- Click an empty 30-minute slot to book an **approved** visit (patient typeahead by name/phone).
- Click-drag a longer range to create a **clinic block**. Blocked times cannot be booked.
- Click an event for patient details, status actions, WhatsApp (`wa.me/91…`), call, Rx, follow-up.

**Other admin views:** Patients, Follow-ups (overdue / imminent / this week), Pending approvals, Closures.

**Public booking** creates `PENDING` visits. Admin-created visits are `APPROVED`.

**Prescriptions** are stored in the database and opened as a printable page (`Save as PDF` from the browser). Google Drive is not used. `googleCalEventId` is a stub field only.

## Statuses

`PENDING` → `APPROVED` → `CONFIRMED`, or `REJECTED` / `CANCELLED`.

## CSV import (old Sheets export)

Dates are `dd-MMM-yyyy` (e.g. `27-Aug-2026`), times `h:mm a` (e.g. `10:30 AM`), timezone Asia/Kolkata.

**Appointments columns:** `Timestamp, Ref, Patient Name, Phone, Email, Service, Date, Time, Notes, Status, CalEvent, RxLink, FollowupDate`

**Patients columns:** `Phone, Name, Email, First Booking, Last Booking, Total Bookings, Services`

**Clinic Closure columns:** `ID, From Date, To Date, Reason, Created At, Time From, Time To`  
If `Time From` / `Time To` are empty, the whole day is closed. A date range is expanded per day.

```bash
npm run import-csv -- --clinic sdc --appointments ./samples/appointments.csv
npm run import-csv -- --clinic sdc --patients ./samples/patients.csv
npm run import-csv -- --clinic sdc --blocks ./samples/closures.csv
```

Sample files live in `samples/`. Import writes to whatever `DATABASE_URL` is (SQLite locally, or the cloud DB if you pointed `.env.local` at Postgres).

## Optional cloud backup

Prisma Postgres and Neon already keep the live data. If you want a JSON dump on a schedule:

```bash
# with DATABASE_URL set to the hosted Postgres URL
npm run backup
```

Files land in `backups/` (gitignored). Restore is a manual import; this is not a second live database.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Migrate + seed (first run) + Next.js dev server (SQLite or Postgres from `.env.local`) |
| `npm run build` | `next build` (used by OpenNext) |
| `npm run build:standalone` | Node standalone build (injects hosted env, migrate, seed) |
| `npm run preview` | OpenNext build + local workerd preview |
| `npm run deploy` | OpenNext build + deploy Worker `proud-truth-84df` |
| `npm run db:seed` | Seed if the database is empty |
| `npm run db:reset` | Drop the local SQLite database, remigrate, reseed |
| `npm run import-csv` | Import Sheets CSV |
| `npm run backup` | JSON snapshot of the connected database |
| `npm run cap:sync` | Copy `www/` + Capacitor config into the Android project |
| `npm run cap:android` | Open the Android project in Android Studio |

## Stack

Next.js 14 (App Router), TypeScript, Prisma (SQLite locally, Postgres in production via driver adapter on Cloudflare Workers), Tailwind CSS, FullCalendar (time grid + drag/resize/select), PWA (web app manifest + service worker), OpenNext (`@opennextjs/cloudflare`) + Wrangler, Capacitor 7 Android WebView shell (`server.url` → `/login`).

Google Calendar sync and Drive Rx are later adapters — the hosted database is the source of truth.
