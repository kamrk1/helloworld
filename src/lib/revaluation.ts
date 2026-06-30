import type { AssetRecord } from "@/lib/types";
import { calculateEquityValue } from "./calculations";

const YAHOO_CHART_URL = "https://query1.finance.yahoo.com/v8/finance/chart";
const FRANKFURTER_URL = "https://api.frankfurter.app/latest";

export function buildYahooSymbol(symbol: string, exchange: string | null): string {
  const upper = symbol.toUpperCase().trim();
  if (upper.includes(".")) return upper;

  switch (exchange) {
    case "NSE":
      return `${upper}.NS`;
    case "BSE":
      return `${upper}.BO`;
    default:
      return upper;
  }
}

export async function fetchStockPrice(yahooSymbol: string): Promise<number> {
  const url = `${YAHOO_CHART_URL}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`;
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 NetWorthCalculator/1.0" },
    next: { revalidate: 0 },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch price for ${yahooSymbol}: HTTP ${response.status}`);
  }

  const data = await response.json();
  const price = data?.chart?.result?.[0]?.meta?.regularMarketPrice;

  if (typeof price !== "number" || price <= 0) {
    throw new Error(`No valid price returned for ${yahooSymbol}`);
  }

  return price;
}

export async function fetchExchangeRates(
  base = "INR"
): Promise<Record<string, number>> {
  const response = await fetch(`${FRANKFURTER_URL}?from=${base}`, {
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    return { INR: 1, USD: 83, EUR: 90, GBP: 105, SGD: 62, AED: 22.6, JPY: 0.55 };
  }

  const data = await response.json();
  const ratesToInr: Record<string, number> = { INR: 1 };

  for (const [currency, rateFromInr] of Object.entries(data.rates as Record<string, number>)) {
    ratesToInr[currency] = 1 / (rateFromInr as number);
  }

  return ratesToInr;
}

export async function revalueEquityAsset(asset: AssetRecord): Promise<{
  currentPrice: number;
  newValue: number;
}> {
  if (!asset.symbol) {
    throw new Error("Asset has no symbol");
  }

  const yahooSymbol = buildYahooSymbol(asset.symbol, asset.exchange);
  const currentPrice = await fetchStockPrice(yahooSymbol);
  const updatedAsset = { ...asset, currentPrice };
  const newValue = calculateEquityValue(updatedAsset);

  return { currentPrice, newValue };
}
