# Net Worth Calculator

A production-grade personal net worth tracker with full CRUD for cash, Indian and foreign equities, savings, bank accounts, and Provident Fund (PF) with mark-to-market calculations.

## Features

- **Asset categories**: Cash, Savings, Bank Accounts (Savings, Current, FD, RD, NRE, NRO), PF, Indian Equity, Foreign Equity
- **CRUD operations**: Add, edit, delete, and list all assets via REST API and web UI
- **Dashboard**: Overall net worth in INR with category-wise breakdown and percentage allocation
- **PF MTM**: Auto-calculated PF value using compound monthly interest from principal, annual rate, start date, and monthly contributions
- **Equity revaluation**: Fetch live prices from Yahoo Finance (free) — revalue individual holdings or all equities at once
- **Fees support**: Brokerage and transaction fees deducted from equity valuations
- **Multi-currency**: Track assets in INR, USD, EUR, GBP, SGD, AED, JPY with live FX conversion via Frankfurter API

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: SQLite via Prisma ORM
- **Validation**: Zod
- **Market data**: Yahoo Finance (equities), Frankfurter (FX rates)

## Quick Start

```bash
# Install dependencies
npm install

# Set up database
cp .env.example .env   # or use the included .env
npx prisma migrate dev

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/assets` | List all assets |
| POST | `/api/assets` | Create asset |
| GET | `/api/assets/:id` | Get single asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| POST | `/api/assets/revalue` | Revalue equities (optional `assetIds` or `category`) |
| GET | `/api/summary` | Net worth summary with category totals |

## Docker

```bash
docker build -t networth-calculator .
docker run -p 3000:3000 -v networth-data:/app/prisma networth-calculator
```

## PF Calculation

PF value is computed as mark-to-market using:

- Principal balance at start date
- Annual interest rate (compounded monthly)
- Monthly employee + employer contributions

Formula: `FV = P(1+r)^n + PMT × [(1+r)^n − 1] / r` where `r` = monthly rate, `n` = months elapsed.

## Equity Revaluation

Indian stocks use Yahoo Finance suffixes: `.NS` (NSE), `.BO` (BSE). Foreign stocks use standard tickers. Value = `(quantity × currentPrice) − fees`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |

## Production Notes

- SQLite is suitable for single-user deployments; switch `provider` to `postgresql` in `prisma/schema.prisma` for multi-user production
- Yahoo Finance and Frankfurter are free public APIs with rate limits — revalue on demand rather than on a schedule
- Data persists in the SQLite file at the path specified by `DATABASE_URL`
