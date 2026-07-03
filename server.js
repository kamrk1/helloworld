const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, "data.json");
const CONFIG_FILE = path.join(ROOT, "config.json");

const MIME = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".ico": "image/x-icon",
};

// ── Data helpers ──────────────────────────────────────────────

function readData() {
  const raw = fs.readFileSync(DATA_FILE, "utf8");
  return JSON.parse(raw);
}

function writeData(data) {
  data.config.lastUpdated = new Date().toISOString();
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
}

// ── Calculations ──────────────────────────────────────────────

function monthsBetween(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return Math.max(0, (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth()));
}

function calculatePfMtm(asset) {
  const principal = asset.principal ?? 0;
  const annualRate = (asset.interestRate ?? 0) / 100;
  const monthlyRate = annualRate / 12;
  const monthlyContribution = asset.monthlyContribution ?? 0;
  if (!asset.startDate) return principal;
  const months = monthsBetween(asset.startDate, new Date());
  if (months === 0) return principal;
  if (monthlyRate === 0) return principal + monthlyContribution * months;
  const compoundedPrincipal = principal * Math.pow(1 + monthlyRate, months);
  const compoundedContributions =
    monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);
  return compoundedPrincipal + compoundedContributions;
}

function calculateEquityValue(asset) {
  const quantity = asset.quantity ?? 0;
  const price = asset.currentPrice ?? asset.purchasePrice ?? 0;
  const fees = asset.fees ?? 0;
  return Math.max(0, quantity * price - fees);
}

function getAssetValue(asset) {
  if (asset.category === "PF") return calculatePfMtm(asset);
  if (asset.category === "EQUITY_INDIAN" || asset.category === "EQUITY_FOREIGN")
    return calculateEquityValue(asset);
  return asset.value ?? 0;
}

function convertToInr(amount, currency, rates) {
  if (currency === "INR") return amount;
  return amount * (rates[currency] ?? 1);
}

async function fetchExchangeRates() {
  try {
    const res = await fetch("https://api.frankfurter.app/latest?from=INR");
    if (!res.ok) throw new Error("FX fetch failed");
    const data = await res.json();
    const rates = { INR: 1 };
    for (const [cur, rateFromInr] of Object.entries(data.rates)) {
      rates[cur] = 1 / rateFromInr;
    }
    return rates;
  } catch {
    return { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 62, AED: 22.6, JPY: 0.55 };
  }
}

function buildYahooSymbol(symbol, exchange) {
  const upper = symbol.toUpperCase().trim();
  if (upper.includes(".")) return upper;
  if (exchange === "NSE") return `${upper}.NS`;
  if (exchange === "BSE") return `${upper}.BO`;
  return upper;
}

async function fetchStockPrice(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0 NetWorthCalculator/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;
  if (typeof price !== "number" || price <= 0) throw new Error("No price returned");
  return price;
}

function buildSummary(assets, rates, appConfig) {
  const CATEGORY_ORDER = ["CASH", "SAVINGS", "BANK_ACCOUNT", "PF", "EQUITY_INDIAN", "EQUITY_FOREIGN"];
  const categoryMap = {};
  for (const cat of CATEGORY_ORDER) categoryMap[cat] = { totalInr: 0, assets: [] };

  let totalInr = 0;
  for (const asset of assets) {
    const value = getAssetValue(asset);
    const valueInr = convertToInr(value, asset.currency, rates);
    totalInr += valueInr;
    if (categoryMap[asset.category]) {
      categoryMap[asset.category].totalInr += valueInr;
      categoryMap[asset.category].assets.push({ ...asset, computedValue: value });
    }
  }

  const categories = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    label: appConfig.categoryLabels[cat] || cat,
    totalInr: categoryMap[cat].totalInr,
    count: categoryMap[cat].assets.length,
    assets: categoryMap[cat].assets,
  }));

  return { totalInr, categories, lastUpdated: new Date().toISOString(), baseCurrency: "INR" };
}

// ── HTTP helpers ──────────────────────────────────────────────

function send(res, status, body, contentType = "application/json") {
  res.writeHead(status, { "Content-Type": contentType, "Access-Control-Allow-Origin": "*" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath);
  const type = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, "Not found", "text/plain");
    res.writeHead(200, { "Content-Type": type });
    res.end(data);
  });
}

// ── Router ────────────────────────────────────────────────────

async function handleApi(req, res, url) {
  const appConfig = readConfig();

  // GET /api/config
  if (req.method === "GET" && url === "/api/config") {
    return send(res, 200, appConfig);
  }

  // GET /api/assets
  if (req.method === "GET" && url === "/api/assets") {
    const data = readData();
    const enriched = data.assets.map((a) => ({ ...a, computedValue: getAssetValue(a) }));
    return send(res, 200, enriched);
  }

  // POST /api/assets
  if (req.method === "POST" && url === "/api/assets") {
    const body = await parseBody(req);
    const data = readData();
    const now = new Date().toISOString();
    const asset = {
      id: randomUUID(),
      name: body.name,
      category: body.category,
      currency: body.currency || "INR",
      notes: body.notes || null,
      value: body.value ?? 0,
      bankName: body.bankName || null,
      accountType: body.accountType || null,
      symbol: body.symbol || null,
      quantity: body.quantity ?? null,
      purchasePrice: body.purchasePrice ?? null,
      currentPrice: body.currentPrice ?? null,
      fees: body.fees ?? 0,
      exchange: body.exchange || null,
      lastRevaluedAt: null,
      principal: body.principal ?? null,
      interestRate: body.interestRate ?? null,
      startDate: body.startDate || null,
      monthlyContribution: body.monthlyContribution ?? null,
      createdAt: now,
      updatedAt: now,
    };
    data.assets.unshift(asset);
    writeData(data);
    return send(res, 201, { ...asset, computedValue: getAssetValue(asset) });
  }

  // PUT /api/assets/:id
  const putMatch = url.match(/^\/api\/assets\/([^/]+)$/);
  if (req.method === "PUT" && putMatch) {
    const id = putMatch[1];
    const body = await parseBody(req);
    const data = readData();
    const idx = data.assets.findIndex((a) => a.id === id);
    if (idx === -1) return send(res, 404, { error: "Not found" });
    const updated = { ...data.assets[idx], ...body, id, updatedAt: new Date().toISOString() };
    data.assets[idx] = updated;
    writeData(data);
    return send(res, 200, { ...updated, computedValue: getAssetValue(updated) });
  }

  // DELETE /api/assets/:id
  const delMatch = url.match(/^\/api\/assets\/([^/]+)$/);
  if (req.method === "DELETE" && delMatch) {
    const id = delMatch[1];
    const data = readData();
    const idx = data.assets.findIndex((a) => a.id === id);
    if (idx === -1) return send(res, 404, { error: "Not found" });
    data.assets.splice(idx, 1);
    writeData(data);
    return send(res, 200, { success: true });
  }

  // GET /api/summary
  if (req.method === "GET" && url === "/api/summary") {
    const data = readData();
    const rates = await fetchExchangeRates();
    return send(res, 200, buildSummary(data.assets, rates, appConfig));
  }

  // POST /api/revalue
  if (req.method === "POST" && url === "/api/revalue") {
    const body = await parseBody(req);
    const data = readData();
    const targets = data.assets.filter((a) => {
      if (a.category !== "EQUITY_INDIAN" && a.category !== "EQUITY_FOREIGN") return false;
      if (body.assetIds?.length) return body.assetIds.includes(a.id);
      if (body.category) return a.category === body.category;
      return true;
    });

    const results = [];
    for (const asset of targets) {
      try {
        const yahooSymbol = buildYahooSymbol(asset.symbol, asset.exchange);
        const currentPrice = await fetchStockPrice(yahooSymbol);
        const newValue = calculateEquityValue({ ...asset, currentPrice });
        asset.currentPrice = currentPrice;
        asset.value = newValue;
        asset.lastRevaluedAt = new Date().toISOString();
        asset.updatedAt = new Date().toISOString();
        results.push({
          id: asset.id, name: asset.name, symbol: asset.symbol,
          currentPrice, newValue, success: true,
        });
      } catch (err) {
        results.push({
          id: asset.id, name: asset.name, symbol: asset.symbol,
          success: false, error: err.message,
        });
      }
    }
    writeData(data);
    const succeeded = results.filter((r) => r.success).length;
    return send(res, 200, {
      message: `Revalued ${succeeded} asset(s)`,
      results, succeeded, failed: results.length - succeeded,
    });
  }

  send(res, 404, { error: "Not found" });
}

// ── Server ────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = req.url.split("?")[0];

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }

  if (url.startsWith("/api/")) {
    try {
      await handleApi(req, res, url);
    } catch (err) {
      console.error(err);
      send(res, 500, { error: err.message });
    }
    return;
  }

  let filePath = path.join(ROOT, url === "/" ? "index.html" : url);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "Forbidden", "text/plain");
  serveStatic(filePath, res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Net Worth Calculator → http://localhost:${PORT}`);
  console.log(`Data file: ${DATA_FILE}`);
});
