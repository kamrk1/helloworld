# Net Worth Calculator

A **progressive web app (PWA)** for tracking net worth — cash, equities, savings, bank accounts, and PF. Deploy free on **Netlify** or run locally with Node.

## Deploy on Netlify (recommended)

### How it works on Netlify

```
Your phone/browser
       ↓
https://your-app.netlify.app     ← permanent HTTPS URL
       ↓
  Static files (HTML/JS/CSS)     ← the webapp UI
       ↓
  Browser localStorage           ← your data (on device)
       ↓
  Netlify Functions              ← Yahoo Finance search & revalue only
```

- **No server database needed** — assets save in your browser (localStorage)
- **Install as app** — "Add to Home Screen" on iPhone/Android
- **Export/Import** — ↓ ↑ buttons backup `data.json` to a file
- **Yahoo Finance** — symbol search & live revalue via Netlify serverless functions

### Steps

1. Push this repo to **GitHub**
2. Sign up at [netlify.com](https://netlify.com)
3. **Add new site → Import an existing project** → connect GitHub
4. Build settings (auto-detected from `netlify.toml`):
   - **Build command:** (leave empty)
   - **Publish directory:** `.`
5. Click **Deploy**
6. You get `https://random-name.netlify.app` — rename in Site settings → Domain management
7. On your phone: open URL → **Share → Add to Home Screen**

### Optional: custom domain

Netlify → Domain management → Add custom domain → follow DNS instructions.

---

## Local development

### Netlify mode (matches production)

```bash
npx netlify dev
```

Opens http://localhost:8888 with functions + localStorage.

### Node server mode (data in `data.json` file)

```bash
node server.js
```

Opens http://localhost:3000 — data saved to `data.json` on disk.

---

## Files

| File | Purpose |
|------|---------|
| `index.html` | Web app UI |
| `app.js` | Frontend logic |
| `calc.js` | PF MTM, summaries, FX |
| `storage.js` | Browser localStorage (Netlify mode) |
| `config.json` | Category labels, currencies |
| `data.json` | Sample / server-mode database |
| `manifest.json` + `sw.js` | PWA install + offline shell |
| `netlify/functions/` | Yahoo search & revalue APIs |
| `server.js` | Optional local Node server |

---

## Features

- CRUD for Cash, Savings, Bank Accounts, PF, Indian & Foreign Equities
- Symbol autocomplete (type `syrma sgs` → picks SYRMA.NS)
- Live equity revaluation via Yahoo Finance
- PF mark-to-market (compound interest)
- Category-wise net worth dashboard
- Multi-currency (INR, USD, EUR, GBP, SGD, AED, JPY)
- Export/import JSON backup

---

## Data & privacy

**Netlify mode:** Data stays in **your browser** on that device. Clear browser data = lost unless you exported a backup. Use ↓ to download backup regularly.

**Node server mode:** Data in `data.json` on the server.

Do not commit real financial data to public GitHub repos.

---

## Other hosting

| Platform | Works? | Notes |
|----------|--------|-------|
| **Netlify** | ✅ Best | PWA + free HTTPS + functions |
| **Render / VPS** | ✅ | Use `node server.js` + `data.json` |
| **Vercel** | ⚠️ | Needs adapter; Netlify is simpler |
| **GitHub Pages alone** | ❌ | No serverless functions for Yahoo API |

See `render.yaml` and `Dockerfile` for Render/Docker deploy.
