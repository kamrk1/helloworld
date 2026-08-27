# Shree Datta Dental Care — Clinic Admin

Calendar-first clinic admin that replaces the old Google Apps Script + Sheets CRM. Appointments, patients, and clinic closures live in **Postgres** (Prisma). Google Calendar and Drive are not required. SQLite `file://` will not persist on Vercel.

Clinic: **Shree Datta Dental Care** · Timezone: **Asia/Kolkata** · Hours: **10:00–20:00**, Sunday closed, 30-minute slots.

## Quick start

```bash
npm install
npx create-db@latest          # instant Postgres URL, no signup
cp .env.example .env          # paste DATABASE_URL; set ADMIN_PASSWORD
npm run dev
```

`npm run dev` creates `.env` from the example if it is missing, runs Prisma migrations, and **seeds sample data on first run**.

Open:

- Public booking: [http://localhost:3000](http://localhost:3000)
- Admin calendar: [http://localhost:3000/admin](http://localhost:3000/admin) (redirects to `/login`)

Default local password from `.env.example` is `changeme`. For local secrets, copy values into `.env.local` (gitignored). The committed `.env` is only a placeholder for hosted builds.

The calendar paints immediately from the last snapshot in `localStorage`, then refreshes from the API. Seeded appointments fill the current week so the grid is not empty.

## Hosting (Vercel)

Vercel serverless cannot use SQLite `file://`. Set `DATABASE_URL` to Postgres (`npx create-db@latest` or Neon), plus `ADMIN_PASSWORD` and `SESSION_SECRET` in the project env. `npm run build` runs `prisma migrate deploy` and seeds if the database is empty.

Anonymous `vercel deploy --temporary` URLs expire in about an hour unless you open the claim URL and attach them to your Vercel account.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | yes | Postgres connection string (`postgresql://…`). `npx create-db@latest` provisions one. |
| `ADMIN_PASSWORD` | yes | Password for `/login`. Stored as an httpOnly session cookie. |
| `SESSION_SECRET` | yes | HMAC secret for the session cookie. Use a long random string in production. |
| `NEXT_PUBLIC_REVIEW_URL` | no | Shown on the appointment panel (Google review link). |
| `NEXT_PUBLIC_CLINIC_PHONE` | no | 10-digit number shown on the public page. |
| `NEXT_PUBLIC_CLINIC_ADDRESS` | no | Printed on prescriptions. |

No Google Apps Script, no `script.google.com`, no hardcoded production secrets.

## What you can do

**Calendar (default admin home)** — Google Calendar-like week/day grid:

- Drag an appointment to reschedule (persists immediately, reverts on conflict).
- Resize to 30 / 60 / 90 minutes.
- Click an empty 30-minute slot to book an **approved** visit (patient typeahead by name/phone).
- Click-drag a longer range to create a **clinic block**. Blocked times cannot be booked.
- Click an event for patient details, status actions, WhatsApp (`wa.me/91…`), call, Rx, follow-up.

**Other admin views:** Patients, Follow-ups (overdue / imminent / this week), Pending approvals, Closures.

**Public booking** creates `PENDING` visits. Admin-created visits are `APPROVED`.

**Prescriptions** are stored locally and opened as a printable page (`Save as PDF` from the browser). Google Drive is not used. `googleCalEventId` is a stub field only.

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

Sample files live in `samples/`.

## Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Migrate + seed (first run) + Next.js dev server |
| `npm run build` | Production build |
| `npm run db:seed` | Seed if the database is empty |
| `npm run db:reset` | Drop the database, remigrate, reseed |
| `npm run import-csv` | Import Sheets CSV |

## Stack

Next.js 14 (App Router), TypeScript, Prisma + Postgres, Tailwind CSS, FullCalendar (time grid + drag/resize/select).

Google Calendar sync and Drive Rx are later adapters — this app is the source of truth.
