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

/** Singapore SGX tickers: D05, O39, U11 */
function isSgxTicker(bare) {
  return /^[A-Z]\d{2}[A-Z]?$/i.test(bare);
}

export function inferExchangeFromSymbol(sym) {
  if (!sym) return null;
  const s = sym.toUpperCase().trim();
  if (s.endsWith(".SI") || s.endsWith(".SG")) return "SGX";
  if (s.endsWith(".NS")) return "NSE";
  if (s.endsWith(".BO")) return "BSE";
  if (s.endsWith(".L")) return "LSE";
  if (isSgxTicker(normalizeSymbolInput(s))) return "SGX";
  return null;
}

/** Canonical Yahoo ticker — fixes D05.SG → D05.SI */
export function toYahooSymbol(symbol, exchange) {
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

export function buildYahooSymbol(symbol, exchange) {
  return toYahooSymbol(symbol, exchange);
}

function cleanDisplaySymbol(yahooSymbol) {
  return (yahooSymbol || "").replace(/\.(NS|BO|L|SI|SG)$/i, "");
}

function currencyForSymbol(yahooSymbol, fetched) {
  if (yahooSymbol?.toUpperCase().endsWith(".SI")) return "SGD";
  if (yahooSymbol?.toUpperCase().endsWith(".NS") || yahooSymbol?.toUpperCase().endsWith(".BO")) return "INR";
  if (yahooSymbol?.toUpperCase().endsWith(".L")) return "GBP";
  return fetched || "USD";
}

export function yahooSymbolCandidates(symbol, exchange, storedYahoo) {
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

export async function searchSymbols(query, market) {
  if (!query || query.length < 1) return { results: [], hint: null };
  const trimmed = query.trim();
  const queries = [trimmed];
  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord.length >= 2 && firstWord !== trimmed) queries.push(firstWord);
  // Allow searching by Yahoo ticker directly e.g. D05.SI
  if (trimmed.toUpperCase().includes(".")) queries.push(trimmed.toUpperCase().replace(/\.SG$/i, ".SI"));

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
  const sym = yahooSymbol.endsWith(".SG") ? yahooSymbol.replace(/\.SG$/, ".SI") : yahooSymbol;
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
  const res = await fetch(url, { headers: YAHOO_HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${sym}`);
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  if (!result) throw new Error(`No data for ${sym}`);
  const price = result.meta?.regularMarketPrice ?? result.meta?.previousClose;
  if (typeof price !== "number" || price <= 0) throw new Error(`No price for ${sym}`);
  const currency = currencyForSymbol(sym, result.meta?.currency);
  return { price, currency, yahooSymbol: sym };
}

async function resolveEquitySymbol(symbol, category, existingYahoo) {
  if (existingYahoo) {
    const y = toYahooSymbol(existingYahoo);
    return { yahooSymbol: y, symbol: cleanDisplaySymbol(y), exchange: inferExchangeFromSymbol(y) };
  }
  const market = category === "EQUITY_INDIAN" ? "indian" : "foreign";
  const { results } = await searchSymbols(symbol, market);
  if (results.length) {
    const r = results[0];
    return { yahooSymbol: r.yahooSymbol, symbol: r.symbol, exchange: r.exchange };
  }
  const y = toYahooSymbol(symbol);
  return { yahooSymbol: y, symbol: cleanDisplaySymbol(y), exchange: inferExchangeFromSymbol(y) };
}

export async function fetchStockPrice(symbol, exchange, storedYahoo, category) {
  const ex = exchange || inferExchangeFromSymbol(symbol) || inferExchangeFromSymbol(storedYahoo);
  const candidates = yahooSymbolCandidates(symbol, ex, storedYahoo);

  if (category) {
    try {
      const resolved = await resolveEquitySymbol(symbol, category, storedYahoo);
      if (resolved.yahooSymbol) candidates.unshift(resolved.yahooSymbol);
    } catch { /* ignore */ }
  }

  const unique = [...new Set(candidates)];
  const errors = [];
  for (const sym of unique) {
    try {
      return await fetchStockPriceOnce(sym);
    } catch (err) {
      errors.push(`${sym}: ${err.message}`);
    }
  }
  throw new Error(`Could not price ${symbol} (tried ${unique.join(", ")})`);
}

export async function revalueAssets(assets) {
  const results = [];
  for (const asset of assets) {
    try {
      const { price, currency, yahooSymbol } = await fetchStockPrice(
        asset.symbol, asset.exchange, asset.yahooSymbol, asset.category
      );
      const fees = asset.fees ?? 0;
      const newValue = Math.max(0, (asset.quantity ?? 0) * price - fees);
      const exchange = inferExchangeFromSymbol(yahooSymbol) || asset.exchange || "SGX";
      results.push({
        id: asset.id,
        name: asset.name,
        symbol: cleanDisplaySymbol(yahooSymbol),
        yahooSymbol,
        exchange,
        currency,
        currentPrice: price,
        priceCurrency: currency,
        newValue,
        success: true,
      });
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
