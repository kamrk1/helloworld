/* Yahoo Finance helpers for Netlify Functions */
const YAHOO_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  Accept: "application/json",
};

export function normalizeSymbolInput(symbol) {
  if (!symbol) return "";
  let upper = symbol.toUpperCase().trim().replace(/\.(NS|BO|L|SI|SG)$/i, "");
  if (upper.includes(" ")) upper = upper.split(/\s+/)[0];
  return upper;
}

export function buildYahooSymbol(symbol, exchange) {
  if (!symbol) return "";
  let upper = normalizeSymbolInput(symbol);
  if (upper.endsWith(".SG")) upper = upper.replace(/\.SG$/, ".SI");
  if (symbol.toUpperCase().includes(".") && symbol.includes(".")) return symbol.toUpperCase().trim();
  switch (exchange) {
    case "NSE": return `${upper}.NS`;
    case "BSE": return `${upper}.BO`;
    case "LSE": return `${upper}.L`;
    case "SGX": return `${upper}.SI`;
    default: return upper;
  }
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
  return score;
}

async function searchSymbolsOnce(query, market) {
  const url = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=20&newsCount=0`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error("Symbol search failed");
  const data = await res.json();
  let quotes = (data.quotes || []).filter((q) => q.quoteType === "EQUITY" && q.symbol);
  if (market === "indian") {
    quotes = quotes.filter((q) =>
      q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO") ||
      ["NSI", "BSE"].includes(q.exchange) || /NSE|Bombay|BSE/i.test(q.exchDisp || "")
    );
  } else if (market === "foreign") {
    quotes = quotes.filter((q) =>
      !q.symbol.endsWith(".NS") && !q.symbol.endsWith(".BO") &&
      !["NSI", "BSE"].includes(q.exchange) && !/NSE|Bombay|BSE/i.test(q.exchDisp || "")
    );
  }
  return quotes.map((q) => ({
    symbol: cleanDisplaySymbol(q.symbol),
    yahooSymbol: q.symbol,
    name: q.longname || q.shortname || q.symbol,
    exchange: mapYahooExchange(q),
    exchangeLabel: q.exchDisp || q.exchange,
    currency: q.currency || (q.symbol.endsWith(".NS") || q.symbol.endsWith(".BO") ? "INR" : "USD"),
  }));
}

export async function searchSymbols(query, market) {
  if (!query || query.length < 1) return { results: [], hint: null };
  const trimmed = query.trim();
  const queries = [trimmed];
  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord.length >= 2 && firstWord !== trimmed) queries.push(firstWord);

  const seen = new Set();
  const all = [];
  for (const q of [...new Set(queries)]) {
    for (const r of await searchSymbolsOnce(q, market)) {
      if (!seen.has(r.yahooSymbol)) { seen.add(r.yahooSymbol); all.push(r); }
    }
  }
  all.sort((a, b) => scoreSearchResult(b, trimmed) - scoreSearchResult(a, trimmed));

  let hint = null;
  if (all.length === 0 && market === "foreign") {
    const indian = await searchSymbolsOnce(trimmed, "indian");
    const alt = indian.length ? indian : (firstWord !== trimmed ? await searchSymbolsOnce(firstWord, "indian") : []);
    if (alt.length) hint = `"${alt[0].name}" is an Indian stock (ticker: ${alt[0].symbol}). Switch category to Indian Equity.`;
  }
  return { results: all.slice(0, 10), hint };
}

async function fetchStockPriceOnce(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error("No data");
  const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose;
  if (typeof price !== "number" || price <= 0) throw new Error("No price");
  return { price, currency: result.meta?.currency || "USD" };
}

async function resolveEquitySymbol(symbol, category, existingYahoo) {
  if (existingYahoo) return { yahooSymbol: existingYahoo };
  const market = category === "EQUITY_INDIAN" ? "indian" : "foreign";
  const { results } = await searchSymbols(symbol, market);
  return results.length ? { yahooSymbol: results[0].yahooSymbol } : { yahooSymbol: null };
}

export async function fetchStockPrice(symbol, exchange, storedYahoo, category) {
  const raw = symbol?.toUpperCase().trim();
  const fixed = raw?.endsWith(".SG") ? raw.replace(/\.SG$/, ".SI") : raw;
  let candidates = [...new Set([storedYahoo, buildYahooSymbol(symbol, exchange), fixed, raw].filter(Boolean))];
  if (category) {
    const resolved = await resolveEquitySymbol(symbol, category, storedYahoo);
    if (resolved.yahooSymbol) candidates = [resolved.yahooSymbol, ...candidates];
  }
  candidates = [...new Set(candidates)];
  for (const sym of candidates) {
    try { return await fetchStockPriceOnce(sym); } catch { /* try next */ }
  }
  throw new Error(`Could not price ${symbol} (tried ${candidates.join(", ")})`);
}

export async function revalueAssets(assets) {
  const results = [];
  for (const asset of assets) {
    try {
      const { price, currency } = await fetchStockPrice(asset.symbol, asset.exchange, asset.yahooSymbol, asset.category);
      const fees = asset.fees ?? 0;
      const newValue = Math.max(0, (asset.quantity ?? 0) * price - fees);
      results.push({ id: asset.id, name: asset.name, symbol: asset.symbol, currentPrice: price, priceCurrency: currency, newValue, success: true });
    } catch (err) {
      results.push({ id: asset.id, name: asset.name, symbol: asset.symbol, success: false, error: err.message });
    }
  }
  const succeeded = results.filter((r) => r.success).length;
  return { message: `Revalued ${succeeded} asset(s)`, results, succeeded, failed: results.length - succeeded };
}

export function jsonResponse(status, body) {
  return {
    statusCode: status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
    body: JSON.stringify(body),
  };
}
