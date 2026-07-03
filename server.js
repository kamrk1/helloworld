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
  if (!symbol) return "";
  let upper = symbol.toUpperCase().trim();
  // Fix common wrong suffixes
  if (upper.endsWith(".SG")) upper = upper.replace(/\.SG$/, ".SI");
  if (upper.includes(".")) return upper;

  switch (exchange) {
    case "NSE": return `${upper}.NS`;
    case "BSE": return `${upper}.BO`;
    case "LSE": return `${upper}.L`;
    case "SGX": return `${upper}.SI`;
    default: return upper;
  }
}

function yahooSymbolCandidates(symbol, exchange, storedYahoo) {
  const built = buildYahooSymbol(symbol, exchange);
  const raw = symbol?.toUpperCase().trim();
  const fixed = raw?.endsWith(".SG") ? raw.replace(/\.SG$/, ".SI") : raw;
  return [...new Set([storedYahoo, built, fixed, raw].filter(Boolean))];
}

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

async function fetchStockPriceOnce(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${yahooSymbol}`);
  const data = await res.json();
  if (data?.chart?.error) throw new Error(data.chart.error.description || "Chart error");
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${yahooSymbol}`);
  const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose;
  if (typeof price !== "number" || price <= 0) throw new Error(`No price for ${yahooSymbol}`);
  return { price, currency: result.meta?.currency || "USD" };
}

async function fetchStockPrice(symbol, exchange, storedYahoo) {
  const candidates = yahooSymbolCandidates(symbol, exchange, storedYahoo);
  const errors = [];
  for (const sym of candidates) {
    try {
      return await fetchStockPriceOnce(sym);
    } catch (err) {
      errors.push(`${sym}: ${err.message}`);
    }
  }
  throw new Error(`Yahoo Finance: could not price ${symbol} (tried ${candidates.join(", ")})`);
}

function mapYahooExchange(quote) {
  const sym = quote.symbol || "";
  const exch = (quote.exchange || quote.exchDisp || "").toUpperCase();
  if (sym.endsWith(".NS") || exch.includes("NSE") || exch === "NSI") return "NSE";
  if (sym.endsWith(".BO") || exch.includes("BOM") || exch === "BSE") return "BSE";
  if (sym.endsWith(".L") || exch.includes("LSE") || exch === "LON") return "LSE";
  if (sym.endsWith(".SI") || exch.includes("SGX") || exch === "SES") return "SGX";
  if (exch.includes("NMS") || exch.includes("NASDAQ")) return "NASDAQ";
  if (exch.includes("NYQ") || exch.includes("NYSE")) return "NYSE";
  return "OTHER";
}

function cleanDisplaySymbol(yahooSymbol) {
  return yahooSymbol.replace(/\.(NS|BO|L|SI|SG)$/i, "");
}

async function searchSymbols(query, market) {
  if (!query || query.length < 1) return [];
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error("Symbol search failed");
  const data = await res.json();
  let quotes = (data.quotes || []).filter((q) => q.quoteType === "EQUITY" && q.symbol);

  if (market === "indian") {
    quotes = quotes.filter(
      (q) =>
        q.symbol.endsWith(".NS") ||
        q.symbol.endsWith(".BO") ||
        ["NSI", "BSE"].includes(q.exchange) ||
        /NSE|Bombay|BSE/i.test(q.exchDisp || "")
    );
  } else if (market === "foreign") {
    quotes = quotes.filter(
      (q) =>
        !q.symbol.endsWith(".NS") &&
        !q.symbol.endsWith(".BO") &&
        !["NSI", "BSE"].includes(q.exchange) &&
        !/NSE|Bombay|BSE/i.test(q.exchDisp || "")
    );
  }

  return quotes.slice(0, 10).map((q) => ({
    symbol: cleanDisplaySymbol(q.symbol),
    yahooSymbol: q.symbol,
    name: q.longname || q.shortname || q.symbol,
    exchange: mapYahooExchange(q),
    exchangeLabel: q.exchDisp || q.exchange,
    currency: q.currency || (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO") ? "INR" : "USD"),
  }));
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

async function handleApi(req, res, url, query) {
  const appConfig = readConfig();

  // GET /api/search?q=&market=indian|foreign
  if (req.method === "GET" && url === "/api/search") {
    const q = query.q || "";
    const market = query.market || "";
    const results = await searchSymbols(q, market);
    return send(res, 200, results);
  }
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
      yahooSymbol: body.yahooSymbol || null,
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
        const { price: currentPrice, currency: priceCurrency } = await fetchStockPrice(
          asset.symbol, asset.exchange, asset.yahooSymbol
        );
        const newValue = calculateEquityValue({ ...asset, currentPrice });
        asset.currentPrice = currentPrice;
        asset.value = newValue;
        asset.yahooSymbol = asset.yahooSymbol || buildYahooSymbol(asset.symbol, asset.exchange);
        if (!asset.currency || asset.currency === "INR") {
          // keep user-set currency; only hint if unset on foreign
        }
        asset.lastRevaluedAt = new Date().toISOString();
        asset.updatedAt = new Date().toISOString();
        results.push({
          id: asset.id, name: asset.name, symbol: asset.symbol,
          yahooSymbol: asset.yahooSymbol,
          currentPrice, priceCurrency, newValue, success: true,
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
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const url = parsed.pathname;
  const query = Object.fromEntries(parsed.searchParams);

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
      await handleApi(req, res, url, query);
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
