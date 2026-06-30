import { differenceInMonths } from "date-fns";
import type { AssetRecord } from "@/lib/types";

/**
 * Calculate PF mark-to-market value using compound interest.
 * Supports monthly contributions with annual interest rate compounded monthly.
 */
export function calculatePfMtm(asset: AssetRecord): number {
  const principal = asset.principal ?? 0;
  const annualRate = (asset.interestRate ?? 0) / 100;
  const monthlyRate = annualRate / 12;
  const monthlyContribution = asset.monthlyContribution ?? 0;

  if (!asset.startDate) {
    return principal;
  }

  const months = Math.max(0, differenceInMonths(new Date(), asset.startDate));

  if (months === 0) {
    return principal;
  }

  if (monthlyRate === 0) {
    return principal + monthlyContribution * months;
  }

  const compoundedPrincipal = principal * Math.pow(1 + monthlyRate, months);
  const compoundedContributions =
    monthlyContribution * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate);

  return compoundedPrincipal + compoundedContributions;
}

/**
 * Calculate equity value: (quantity * currentPrice) - fees
 */
export function calculateEquityValue(asset: AssetRecord): number {
  const quantity = asset.quantity ?? 0;
  const price = asset.currentPrice ?? asset.purchasePrice ?? 0;
  const fees = asset.fees ?? 0;
  return Math.max(0, quantity * price - fees);
}

/**
 * Get the effective current value of an asset in its native currency.
 */
export function getAssetValue(asset: AssetRecord): number {
  switch (asset.category) {
    case "PF":
      return calculatePfMtm(asset);
    case "EQUITY_INDIAN":
    case "EQUITY_FOREIGN":
      return calculateEquityValue(asset);
    default:
      return asset.value;
  }
}

/**
 * Convert amount from source currency to INR using exchange rates map.
 */
export function convertToInr(
  amount: number,
  currency: string,
  rates: Record<string, number>
): number {
  if (currency === "INR") return amount;
  const rate = rates[currency];
  if (!rate) return amount;
  return amount * rate;
}
