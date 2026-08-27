# Shree Datta Dental Care — Clinic Admin

Calendar-first clinic admin (replaces the old Google Apps Script + Sheets CRM). **Phone and desktop are clients of the same hosted app.** The live source of truth is the **cloud database** (Prisma Postgres). Each device can install the app as a **PWA** and paints the last saved week instantly from a local cache. Writes go to the cloud when you are online.

Clinic: **Shree Datta Dental Care** · Timezone: **Asia/Kolkata** · Hours: **10:00–20:00**, Sunday closed, 30-minute slots.

## How data works

| Layer | Role |
|-------|------|
| Hosted Postgres (`DATABASE_URL` on Vercel) | Live clinic database. Bookings from any phone or desktop land here. |
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

- Public booking: [http://localhost:3000](http://localhost:3000)
- Admin calendar: [http://localhost:3000/admin](http://localhost:3000/admin)

Default local password from `.env.example` is `changeme`. The SQLite file is created next to the Prisma schema (`prisma/clinic.db`).

To point the same laptop at the live cloud DB instead, put the Postgres URL in `.env.local` as `DATABASE_URL`. Then `npm run dev` migrates and uses Postgres — the same database the public site uses.

## Install as a PWA (phone and desktop)

The production site is installable. After you deploy:

**Android / Chrome / Edge (desktop or mobile)**

1. Open the hosted URL and sign in at `/login`.
2. Browser menu → **Install app** / **Add to Home Screen**, or use the install banner in the admin sidebar.
3. The icon opens the calendar full screen (`start_url` is `/admin`).

**iPhone / iPad (Safari)**

1. Open the hosted URL in Safari (not Chrome in-app).
2. Tap Share → **Add to Home Screen**.
3. Open **SDC Clinic** from the home screen.

The calendar uses a **day** grid on a phone-sized viewport and **week** on desktop. You can still switch Week / Day. Drag, tap-to-book, and long-press work in the installed app.

While offline, the last snapshot still paints. Creating or moving an appointment requires a network connection so every device stays on the same cloud copy.

## Hosting (Vercel)

Vercel serverless **cannot** use SQLite `file://`. Set `DATABASE_URL` to Postgres (`npx create-db@latest`, Prisma Postgres, or Neon), plus `ADMIN_PASSWORD` and `SESSION_SECRET` in the project env. `npm run build` runs cloud migrations and seeds only if the database is empty.

That hosted database **is** the live clinic DB. The public URL is not a delayed copy: phones and desktops that open it (or the installed PWA) read and write the same rows.

Anonymous `vercel deploy --temporary` URLs expire in about an hour unless you open the claim URL and attach them to your Vercel account.

### Free-tier notes

- **Prisma Postgres** (`npx create-db@latest`) — fastest path for a preview URL. Claim the database so it does not expire.
- **Neon** — serverless Postgres, generous free tier, point-in-time restore on paid; nightly backup is optional.
- **Turso** — SQLite-compatible edge DB. Not required here; production stays on Prisma Postgres so the existing schema and Vercel path keep working.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Local: `file:./clinic.db`. Production: Postgres (`postgresql://…` or `prisma+postgres://…`). |
| `ADMIN_PASSWORD` | yes | Password for `/login`. Stored as an httpOnly session cookie. |
| `SESSION_SECRET` | yes | HMAC secret for the session cookie. Use a long random string in production. |
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
npm run import-csv -- --appointments ./samples/appointments.csv
npm run import-csv -- --patients ./samples/patients.csv
npm run import-csv -- --blocks ./samples/closures.csv
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
| `npm run dev` | Migrate + seed (first run) + Next.js dev server |
| `npm run build` | Production build (Postgres when `DATABASE_URL` is postgres) |
| `npm run db:seed` | Seed if the database is empty |
| `npm run db:reset` | Drop the local SQLite database, remigrate, reseed |
| `npm run import-csv` | Import Sheets CSV |
| `npm run backup` | JSON snapshot of the connected database |

## Stack

Next.js 14 (App Router), TypeScript, Prisma (SQLite locally, Postgres in production), Tailwind CSS, FullCalendar (time grid + drag/resize/select), PWA (web app manifest + service worker).

Google Calendar sync and Drive Rx are later adapters — the hosted database is the source of truth.
