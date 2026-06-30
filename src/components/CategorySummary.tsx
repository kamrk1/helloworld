"use client";

import type { AssetCategory } from "@/lib/types";
import { CATEGORY_LABELS } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<AssetCategory, string> = {
  CASH: "bg-emerald-500",
  SAVINGS: "bg-teal-500",
  BANK_ACCOUNT: "bg-cyan-500",
  PF: "bg-violet-500",
  EQUITY_INDIAN: "bg-amber-500",
  EQUITY_FOREIGN: "bg-orange-500",
};

const CATEGORY_BG: Record<AssetCategory, string> = {
  CASH: "bg-emerald-50 border-emerald-200",
  SAVINGS: "bg-teal-50 border-teal-200",
  BANK_ACCOUNT: "bg-cyan-50 border-cyan-200",
  PF: "bg-violet-50 border-violet-200",
  EQUITY_INDIAN: "bg-amber-50 border-amber-200",
  EQUITY_FOREIGN: "bg-orange-50 border-orange-200",
};

interface CategoryCardProps {
  category: AssetCategory;
  label: string;
  totalInr: number;
  count: number;
  overallTotal: number;
}

export function CategoryCard({ category, label, totalInr, count, overallTotal }: CategoryCardProps) {
  const pct = overallTotal > 0 ? (totalInr / overallTotal) * 100 : 0;

  return (
    <div className={cn("rounded-xl border p-5 transition-shadow hover:shadow-md", CATEGORY_BG[category])}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2.5 w-2.5 rounded-full", CATEGORY_COLORS[category])} />
            <h3 className="font-semibold text-slate-800">{label}</h3>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {count} asset{count !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-slate-900">{formatCurrency(totalInr)}</p>
          <p className="text-sm text-slate-500">{pct.toFixed(1)}%</p>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/60">
        <div
          className={cn("h-full rounded-full transition-all", CATEGORY_COLORS[category])}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface TotalHeroProps {
  totalInr: number;
  assetCount: number;
  lastUpdated: string;
}

export function TotalHero({ totalInr, assetCount, lastUpdated }: TotalHeroProps) {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
      <p className="text-sm font-medium uppercase tracking-wider text-slate-400">Total Net Worth</p>
      <p className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl">{formatCurrency(totalInr)}</p>
      <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-400">
        <span>{assetCount} assets tracked</span>
        <span>·</span>
        <span>Updated {new Date(lastUpdated).toLocaleString("en-IN")}</span>
        <span>·</span>
        <span>Base: INR</span>
      </div>
    </div>
  );
}

export { CATEGORY_LABELS };
