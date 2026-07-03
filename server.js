const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const DATA_FILE = process.env.DATA_FILE || path.join(ROOT, "data.json");
const CONFIG_FILE = path.join(ROOT, "config.json");

// Ensure data file exists on first run (important for fresh deploys)
function ensureDataFile() {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ config: { baseCurrency: "INR", lastUpdated: null }, assets: [] }, null, 2)
    );
  }
}
ensureDataFile();

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
  const FALLBACK = { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 74, AED: 22.6, JPY: 0.55 };

  function parseInrBase(data) {
    const raw = data?.rates;
    if (!raw) throw new Error("No rates");
    const rates = { INR: 1 };
    for (const [cur, rateFromInr] of Object.entries(raw)) {
      if (rateFromInr > 0) rates[cur] = 1 / rateFromInr;
    }
    return rates;
  }

  const sources = [
    "https://open.er-api.com/v6/latest/INR",
    "https://api.exchangerate-api.com/v4/latest/INR",
  ];

  for (const url of sources) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const data = await res.json();
      if (data.result && data.result !== "success") continue;
      return parseInrBase(data);
    } catch { /* try next */ }
  }

  return FALLBACK;
}

function isSgxTicker(bare) {
  return /^[A-Z]\d{2}[A-Z]?$/i.test(bare);
}

function inferExchangeFromSymbol(sym) {
  if (!sym) return null;
  const s = sym.toUpperCase().trim();
  if (s.endsWith(".SI") || s.endsWith(".SG")) return "SGX";
  if (s.endsWith(".NS")) return "NSE";
  if (s.endsWith(".BO")) return "BSE";
  if (s.endsWith(".L")) return "LSE";
  if (isSgxTicker(normalizeSymbolInput(s))) return "SGX";
  return null;
}

function toYahooSymbol(symbol, exchange) {
  if (!symbol) return "";
  const raw = symbol.toUpperCase().trim();
  if (raw.endsWith(".SG")) return raw.replace(/\.SG$/, ".SI");
  if (raw.includes(".")) return raw;
  const bare = normalizeSymbolInput(raw);
  const ex = exchange || inferExchangeFromSymbol(raw);
  switch (ex) {
    case "NSE": return `${bare}.NS`;
    case "BSE": return `${bare}.BO`;
    case "LSE": return `${bare}.L`;
    case "SGX": return `${bare}.SI`;
    default: return bare;
  }
}

function buildYahooSymbol(symbol, exchange) {
  return toYahooSymbol(symbol, exchange);
}

function currencyForSymbol(yahooSymbol, fetched) {
  if (yahooSymbol?.toUpperCase().endsWith(".SI")) return "SGD";
  if (yahooSymbol?.toUpperCase().endsWith(".NS") || yahooSymbol?.toUpperCase().endsWith(".BO")) return "INR";
  if (yahooSymbol?.toUpperCase().endsWith(".L")) return "GBP";
  return fetched || "USD";
}

function yahooSymbolCandidates(symbol, exchange, storedYahoo) {
  const raw = (symbol || "").toUpperCase().trim();
  const bare = normalizeSymbolInput(symbol);
  const ex = exchange || inferExchangeFromSymbol(raw) || inferExchangeFromSymbol(storedYahoo);
  const list = [];
  if (storedYahoo) list.push(toYahooSymbol(storedYahoo, ex));
  if (raw) list.push(toYahooSymbol(raw, ex));
  if (raw.endsWith(".SG")) list.push(raw.replace(/\.SG$/, ".SI"));
  if (bare && (ex === "SGX" || isSgxTicker(bare))) list.push(`${bare}.SI`);
  if (bare) list.push(toYahooSymbol(bare, ex));
  return [...new Set(list.filter(Boolean))];
}

const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

async function fetchStockPriceOnce(yahooSymbol) {
  const sym = yahooSymbol.endsWith(".SG") ? yahooSymbol.replace(/\.SG$/, ".SI") : yahooSymbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sym}`);
  const data = await res.json();
  if (data?.chart?.error) throw new Error(data.chart.error.description || "Chart error");
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${sym}`);
  const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose;
  if (typeof price !== "number" || price <= 0) throw new Error(`No price for ${sym}`);
  const currency = currencyForSymbol(sym, result.meta?.currency);
  return { price, currency, yahooSymbol: sym };
}

async function fetchStockPrice(symbol, exchange, storedYahoo, category) {
  const ex = exchange || inferExchangeFromSymbol(symbol) || inferExchangeFromSymbol(storedYahoo);
  let candidates = yahooSymbolCandidates(symbol, ex, storedYahoo);

  if (category) {
    try {
      const resolved = await resolveEquitySymbol(symbol, category, storedYahoo);
      if (resolved.yahooSymbol) candidates = [resolved.yahooSymbol, ...candidates];
    } catch { /* ignore */ }
  }

  candidates = [...new Set(candidates)];
  for (const sym of candidates) {
    try {
      return await fetchStockPriceOnce(sym);
    } catch { /* try next */ }
  }
  throw new Error(`Yahoo Finance: could not price ${symbol} (tried ${candidates.join(", ")})`);
}

function mapYahooExchange(quote) {
  const sym = quote.symbol || "";
  const exch = (quote.exchange || quote.exchDisp || "").toUpperCase();
  if (sym.endsWith(".NS") || exch.includes("NSE") || exch === "NSI") return "NSE";
  if (sym.endsWith(".BO") || exch.includes("BOM") || exch === "BSE") return "BSE";
  if (sym.endsWith(".L") || exch.includes("LSE") || exch === "LON") return "LSE";
  if (sym.endsWith(".SI") || sym.endsWith(".SG") || exch.includes("SGX") || exch === "SES" || exch.includes("SINGAPORE")) return "SGX";
  if (exch.includes("NMS") || exch.includes("NASDAQ")) return "NASDAQ";
  if (exch.includes("NYQ") || exch.includes("NYSE")) return "NYSE";
  return "OTHER";
}

function cleanDisplaySymbol(yahooSymbol) {
  return yahooSymbol.replace(/\.(NS|BO|L|SI|SG)$/i, "");
}

function normalizeSymbolInput(symbol) {
  if (!symbol) return "";
  let upper = symbol.toUpperCase().trim().replace(/\.(NS|BO|L|SI|SG)$/i, "");
  // "SYRMA SGS" → ticker is SYRMA on NSE (not SYRMASGS)
  if (upper.includes(" ")) upper = upper.split(/\s+/)[0];
  return upper;
}

function scoreSearchResult(result, query) {
  const q = query.toLowerCase().trim();
  const words = q.split(/\s+/).filter(Boolean);
  let score = 0;
  const name = (result.name || "").toLowerCase();
  const sym = (result.symbol || "").toLowerCase();
  if (name.includes(q)) score += 20;
  for (const w of words) {
    if (w.length >= 2 && name.includes(w)) score += 8;
    if (sym.includes(w)) score += 5;
  }
  if (sym === q.replace(/\s/g, "")) score += 15;
  return score;
}

async function searchSymbolsOnce(query, market) {
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

  return quotes.map((q) => {
    const yahooSymbol = q.symbol.endsWith(".SG") ? q.symbol.replace(/\.SG$/, ".SI") : q.symbol;
    const exchange = mapYahooExchange({ ...q, symbol: yahooSymbol });
    return {
      symbol: cleanDisplaySymbol(yahooSymbol),
      yahooSymbol,
      name: q.longname || q.shortname || q.symbol,
      exchange,
      exchangeLabel: q.exchDisp || q.exchange,
      currency: yahooSymbol.endsWith(".SI") ? "SGD" : (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO") ? "INR" : (q.currency || "USD")),
    };
  });
}

async function searchSymbols(query, market) {
  if (!query || query.length < 1) return { results: [], hint: null };

  const trimmed = query.trim();
  const queries = [trimmed];
  const firstWord = trimmed.split(/\s+/)[0];
  const noSpaces = trimmed.replace(/\s+/g, "");

  if (firstWord.length >= 2 && firstWord !== trimmed) queries.push(firstWord);
  // Avoid searching SYRMASGS — only add noSpaces if it differs and isn't a glued name
  if (noSpaces !== trimmed && noSpaces.length >= 2 && !trimmed.includes(" ")) {
    queries.push(noSpaces);
  }

  const seen = new Set();
  const all = [];
  for (const q of [...new Set(queries)]) {
    const batch = await searchSymbolsOnce(q, market);
    for (const r of batch) {
      if (!seen.has(r.yahooSymbol)) {
        seen.add(r.yahooSymbol);
        all.push(r);
      }
    }
  }

  all.sort((a, b) => scoreSearchResult(b, trimmed) - scoreSearchResult(a, trimmed));

  let hint = null;
  if (all.length === 0 && market === "foreign") {
    const indian = await searchSymbolsOnce(trimmed, "indian");
    if (!indian.length && firstWord !== trimmed) {
      const more = await searchSymbolsOnce(firstWord, "indian");
      if (more.length) {
        hint = `"${more[0].name}" is an Indian stock (ticker: ${more[0].symbol}). Switch category to Indian Equity.`;
      }
    } else if (indian.length) {
      hint = `"${indian[0].name}" is an Indian stock (ticker: ${indian[0].symbol}). Switch category to Indian Equity.`;
    }
  }

  return { results: all.slice(0, 10), hint };
}

async function resolveEquitySymbol(symbol, category, existingYahoo) {
  if (existingYahoo) {
    const y = toYahooSymbol(existingYahoo);
    return { yahooSymbol: y, symbol: cleanDisplaySymbol(y), exchange: inferExchangeFromSymbol(y) };
  }
  const market = category === "EQUITY_INDIAN" ? "indian" : "foreign";
  const { results } = await searchSymbols(symbol, market);
  if (results.length) {
    return { yahooSymbol: results[0].yahooSymbol, symbol: results[0].symbol, exchange: results[0].exchange };
  }
  const y = toYahooSymbol(symbol);
  return { yahooSymbol: y, symbol: cleanDisplaySymbol(y), exchange: inferExchangeFromSymbol(y) };
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
      categoryMap[asset.category].assets.push({
        ...asset,
        computedValue: value,
        computedValueInr: valueInr,
      });
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

  if (req.method === "GET" && url === "/api/fx-rates") {
    const rates = await fetchExchangeRates();
    return send(res, 200, rates);
  }

  if (req.method === "GET" && url === "/api/health") {
    return send(res, 200, { status: "ok", dataFile: DATA_FILE });
  }

  // GET /api/search?q=&market=indian|foreign
  if (req.method === "GET" && url === "/api/search") {
    const q = query.q || "";
    const market = query.market || "";
    const { results, hint } = await searchSymbols(q, market);
    return send(res, 200, { results, hint });
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

    if ((body.category === "EQUITY_INDIAN" || body.category === "EQUITY_FOREIGN") && body.symbol) {
      const resolved = await resolveEquitySymbol(body.symbol, body.category, body.yahooSymbol);
      body.symbol = resolved.symbol || normalizeSymbolInput(body.symbol);
      body.yahooSymbol = body.yahooSymbol || resolved.yahooSymbol;
      if (!body.exchange && resolved.exchange) body.exchange = resolved.exchange;
      if (resolved.currency && body.currency === "INR" && body.category === "EQUITY_FOREIGN") {
        body.currency = resolved.currency;
      }
    }

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
    const source = body.assets?.length ? body.assets : data.assets;
    const targets = source.filter((a) => {
      if (a.category !== "EQUITY_INDIAN" && a.category !== "EQUITY_FOREIGN") return false;
      if (body.assetIds?.length) return body.assetIds.includes(a.id);
      if (body.category) return a.category === body.category;
      return true;
    });

    const results = [];
    for (const asset of targets) {
      const stored = data.assets.find((a) => a.id === asset.id) || asset;
      try {
        const { price: currentPrice, currency: priceCurrency, yahooSymbol } = await fetchStockPrice(
          asset.symbol, asset.exchange, asset.yahooSymbol, asset.category
        );
        const newValue = calculateEquityValue({ ...asset, currentPrice });
        const cleanSymbol = cleanDisplaySymbol(yahooSymbol);
        const exchange = inferExchangeFromSymbol(yahooSymbol) || asset.exchange || "SGX";

        stored.currentPrice = currentPrice;
        stored.value = newValue;
        stored.yahooSymbol = yahooSymbol;
        stored.symbol = cleanSymbol;
        stored.exchange = exchange;
        stored.currency = priceCurrency;
        stored.lastRevaluedAt = new Date().toISOString();
        stored.updatedAt = new Date().toISOString();

        results.push({
          id: asset.id, name: asset.name, symbol: cleanSymbol,
          yahooSymbol, exchange, currency: priceCurrency,
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
