# AGENTS.md

## Cursor Cloud specific instructions

This is a single **Next.js 14 (App Router) + Prisma + SQLite** app called "Net Worth Calculator". Frontend (React UI) and backend (Next.js API routes under `src/app/api/*`) run in the **same single process** on port **3000**. There are no separate services.

Standard commands live in `package.json` (`dev`, `build`, `start`, `lint`, `db:migrate`) and setup steps in `README.md`. Notes below cover only non-obvious caveats.

- **`.env` is required and git-ignored.** Prisma reads `DATABASE_URL` from it. If `.env` is missing, create it with `cp .env.example .env` (default is `DATABASE_URL="file:./dev.db"`, an embedded SQLite file — no DB server needed).
- **Database setup is not part of the startup update script.** Before running/using the app, ensure migrations are applied with `npx prisma migrate deploy` (idempotent). Use `npm run db:migrate` (`prisma migrate dev`) when creating new migrations.
- **Run the app in dev mode with `npm run dev`** (http://localhost:3000). Do not use `npm run build`/`npm start` for development — `build` also runs `prisma generate && prisma migrate deploy`.
- **API enum values are strict.** `category` must be one of `CASH`, `SAVINGS`, `BANK_ACCOUNT`, `PF`, `EQUITY_INDIAN`, `EQUITY_FOREIGN`; bank `accountType` is `SAVINGS`/`CURRENT`/`FIXED_DEPOSIT`/`RECURRING_DEPOSIT`/`NRE`/`NRO`/`OTHER`. See `src/lib/validation.ts` for the full Zod schema.
- **Equity revaluation (`/api/assets/revalue`) and FX conversion** call external free APIs (Yahoo Finance, Frankfurter). These are optional and only needed for those features; core CRUD/dashboard work offline.
- Node 20 is the documented target (Dockerfile uses `node:20-alpine`); the app also runs fine on the Node 22 present in this environment.
