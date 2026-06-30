import type { AssetCategory, AssetRecord } from "@/lib/types";
import { prisma } from "./prisma";
import { convertToInr, getAssetValue } from "./calculations";
import { fetchExchangeRates } from "./revaluation";
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type CategorySummary,
  type NetWorthSummary,
} from "./types";

export async function getNetWorthSummary(): Promise<NetWorthSummary> {
  const assets = await prisma.asset.findMany({ orderBy: { updatedAt: "desc" } });
  const rates = await fetchExchangeRates("INR");

  const categoryMap = new Map<AssetCategory, { totalInr: number; assets: AssetRecord[] }>();

  for (const category of CATEGORY_ORDER) {
    categoryMap.set(category, { totalInr: 0, assets: [] });
  }

  let totalInr = 0;

  for (const asset of assets) {
    const value = getAssetValue(asset);
    const valueInr = convertToInr(value, asset.currency, rates);
    totalInr += valueInr;

    const entry = categoryMap.get(asset.category as AssetCategory)!;
    entry.totalInr += valueInr;
    entry.assets.push({ ...asset, value });
  }

  const categories: CategorySummary[] = CATEGORY_ORDER.map((category) => {
    const entry = categoryMap.get(category)!;
    return {
      category,
      label: CATEGORY_LABELS[category],
      totalInr: entry.totalInr,
      count: entry.assets.length,
      assets: entry.assets,
    };
  }).filter((c) => c.count > 0 || CATEGORY_ORDER.includes(c.category));

  return {
    totalInr,
    categories,
    lastUpdated: new Date().toISOString(),
    baseCurrency: "INR",
  };
}

export function formatCurrency(amount: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "INR" ? 0 : 2,
  }).format(amount);
}

export function formatNumber(amount: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(amount);
}
