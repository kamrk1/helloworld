# Net Worth Calculator

A simple net worth tracker built with **plain HTML + JSON**. No framework, no database server — your data lives in `data.json`.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Web UI |
| `app.js` | Frontend logic |
| `styles.css` | Styling (mobile-friendly) |
| `data.json` | **Your database** — all assets stored here |
| `config.json` | Labels, currencies, category config |
| `server.js` | Tiny Node server (serves HTML + read/write JSON) |

## Quick Start

```bash
node server.js
```

Open **http://localhost:3000** on desktop or mobile.

## Features

- **CRUD** for Cash, Savings, Bank Accounts (Savings/Current/FD/RD/NRE/NRO), PF, Indian & Foreign Equities
- **Dashboard** with total net worth and category-wise breakdown
- **PF MTM** — auto-calculated from principal, interest rate, start date, monthly contributions
- **Equity revaluation** — live prices from Yahoo Finance (free), fees deducted
- **Multi-currency** — INR, USD, EUR, GBP, SGD, AED, JPY with FX conversion

## Data Storage

All assets are saved to `data.json`:

```json
{
  "config": { "baseCurrency": "INR", "lastUpdated": "..." },
  "assets": [ ... ]
}
```

You can back up, edit, or version-control this file directly. Category labels and currencies are in `config.json`.

## Deploy

Works on any host that runs Node.js:

```bash
PORT=3000 node server.js
```

Or open the HTML files with the server running on a VPS, Railway, Render, etc.

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/config` | App config |
| GET | `/api/assets` | List assets |
| POST | `/api/assets` | Create asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| GET | `/api/summary` | Net worth summary |
| POST | `/api/revalue` | Revalue equities |
