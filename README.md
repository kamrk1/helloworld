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

## Quick Start (local)

```bash
node server.js
```

Open **http://localhost:3000** on desktop or mobile.

## Features

- **CRUD** for Cash, Savings, Bank Accounts, PF, Indian & Foreign Equities
- **Dashboard** with total net worth and category-wise breakdown
- **PF MTM** — compound interest from principal, rate, start date, contributions
- **Equity revaluation** — live Yahoo Finance prices
- **Symbol search** — type company name (e.g. `syrma sgs`) or ticker
- **Multi-currency** — INR, USD, EUR, GBP, SGD, AED, JPY

---

## Permanent production deploy

### How it works in production

```
Your phone/browser
       │
       ▼
  https://your-app.onrender.com   ← public HTTPS URL (always on*)
       │
       ▼
   server.js (Node)                ← serves HTML + API
       │
       ├── index.html / app.js / styles.css
       └── data.json               ← your net worth data (persisted on disk)
```

\* Free tiers may sleep after ~15 min idle; first visit wakes it up (~30s).

The app is a **single Node process**. There is no separate database — `data.json` on disk is your database. Yahoo Finance is called live when you hit **Revalue**.

### Option 1: Render (recommended, free to start)

Best for personal use with zero server management.

1. Push this repo to **GitHub** (branch `cursor/net-worth-calculator-5058` or merge to `master`)
2. Sign up at [render.com](https://render.com)
3. **New → Blueprint** → connect your GitHub repo
4. Render reads `render.yaml` automatically → click **Apply**
5. You get a permanent URL like `https://networth-calculator-xxxx.onrender.com`
6. Open that URL on any phone or browser — bookmark it

**Data:** `data.json` persists across restarts on Render's disk. Back it up periodically (download from shell or git — don't commit private data to public repos).

**Free tier limits:** App sleeps when idle; wakes on first request. Upgrade to paid ($7/mo) for always-on + more reliable disk.

### Option 2: Railway

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Set start command: `node server.js`
3. Add a **Volume** mounted at `/app/data` and set env `DATA_FILE=/app/data/data.json`
4. Railway gives you a public `*.up.railway.app` URL

Good if you want a volume for explicit data persistence.

### Option 3: VPS (DigitalOcean, AWS, Hetzner)

Full control, always-on, ~$4–6/mo.

```bash
# On your server
git clone https://github.com/kamrk1/helloworld.git
cd helloworld
node server.js   # or use pm2 below
```

**Keep it running with PM2:**

```bash
npm install -g pm2
pm2 start server.js --name networth
pm2 save && pm2 startup
```

**HTTPS:** Put **Caddy** or **Nginx** in front with Let's Encrypt for `https://networth.yourdomain.com`.

### Option 4: Docker (any cloud)

```bash
docker build -t networth .
docker run -d -p 3000:3000 -v networth-data:/app/data \
  -e DATA_FILE=/app/data/data.json \
  --restart unless-stopped networth
```

Works on Fly.io, Google Cloud Run (with volume), home NAS, etc.

### Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | HTTP port (set automatically on Render/Railway) |
| `DATA_FILE` | `./data.json` | Path to your JSON database file |
| `NODE_ENV` | — | Set `production` on deploy |

### Backing up your data

Your net worth is in `data.json`. To back up:

```bash
# Copy locally from server
scp user@your-server:/path/to/data.json ./backup-$(date +%F).json
```

Or on Render: **Shell** tab → `cat data.json` → copy/save.

**Do not** commit `data.json` with real financial data to a public GitHub repo.

### What won't work for permanent prod

| Platform | Why |
|----------|-----|
| **GitHub Pages / static hosting** | No Node server → can't save to `data.json` |
| **Vercel serverless** | Ephemeral disk → data lost between requests |
| **Opening `index.html` as a file** | Browser can't write JSON; APIs won't work |
| **Cloudflare quick tunnel** | Temporary preview only (what we used for demos) |

---

## API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/config` | App config |
| GET | `/api/assets` | List assets |
| POST | `/api/assets` | Create asset |
| PUT | `/api/assets/:id` | Update asset |
| DELETE | `/api/assets/:id` | Delete asset |
| GET | `/api/search?q=&market=` | Symbol autocomplete |
| GET | `/api/summary` | Net worth summary |
| POST | `/api/revalue` | Revalue equities |
