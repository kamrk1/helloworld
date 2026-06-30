"use client";

import { useState } from "react";
import type { Asset, AssetCategory } from "@/lib/types";
import {
  BANK_ACCOUNT_LABELS,
  CATEGORY_LABELS,
  EXCHANGE_LABELS,
} from "@/lib/types";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { Pencil, Trash2, RefreshCw } from "lucide-react";

interface AssetListProps {
  assets: (Asset & { computedValue?: number })[];
  onEdit: (asset: Asset) => void;
  onDelete: (id: string) => void;
  onRevalue: (id: string) => void;
  revaluingId?: string | null;
}

const CATEGORY_BADGE: Record<AssetCategory, string> = {
  CASH: "bg-emerald-100 text-emerald-800",
  SAVINGS: "bg-teal-100 text-teal-800",
  BANK_ACCOUNT: "bg-cyan-100 text-cyan-800",
  PF: "bg-violet-100 text-violet-800",
  EQUITY_INDIAN: "bg-amber-100 text-amber-800",
  EQUITY_FOREIGN: "bg-orange-100 text-orange-800",
};

function AssetDetails({ asset }: { asset: Asset }) {
  switch (asset.category) {
    case "EQUITY_INDIAN":
    case "EQUITY_FOREIGN":
      return (
        <span className="text-xs text-slate-500">
          {asset.symbol}
          {asset.exchange ? ` · ${EXCHANGE_LABELS[asset.exchange]}` : ""}
          {" · "}
          {asset.quantity} shares @ {formatCurrency(asset.currentPrice ?? asset.purchasePrice ?? 0, asset.currency)}
          {(asset.fees ?? 0) > 0 && ` · Fees: ${formatCurrency(asset.fees ?? 0, asset.currency)}`}
          {asset.lastRevaluedAt && ` · Revalued ${formatDate(asset.lastRevaluedAt)}`}
        </span>
      );
    case "PF":
      return (
        <span className="text-xs text-slate-500">
          Principal {formatCurrency(asset.principal ?? 0, asset.currency)}
          {" · "}
          {asset.interestRate}% p.a.
          {asset.monthlyContribution ? ` · ${formatCurrency(asset.monthlyContribution, asset.currency)}/mo` : ""}
          {asset.startDate && ` · Since ${formatDate(asset.startDate)}`}
        </span>
      );
    case "BANK_ACCOUNT":
      return (
        <span className="text-xs text-slate-500">
          {asset.accountType ? BANK_ACCOUNT_LABELS[asset.accountType] : "Account"}
          {asset.bankName ? ` · ${asset.bankName}` : ""}
        </span>
      );
    case "SAVINGS":
      return (
        <span className="text-xs text-slate-500">
          {asset.bankName ? `At ${asset.bankName}` : "Savings account"}
        </span>
      );
    default:
      return asset.notes ? (
        <span className="text-xs text-slate-500">{asset.notes}</span>
      ) : null;
  }
}

export function AssetList({ assets, onEdit, onDelete, onRevalue, revaluingId }: AssetListProps) {
  const [filter, setFilter] = useState<AssetCategory | "ALL">("ALL");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered =
    filter === "ALL" ? assets : assets.filter((a) => a.category === filter);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this asset?")) return;
    setDeletingId(id);
    await onDelete(id);
    setDeletingId(null);
  };

  if (assets.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-12 text-center">
        <p className="text-lg font-medium text-slate-600">No assets yet</p>
        <p className="mt-1 text-sm text-slate-500">Add your first asset to start tracking your net worth.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={filter === "ALL"} onClick={() => setFilter("ALL")} label="All" />
        {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
          <FilterChip
            key={cat}
            active={filter === cat}
            onClick={() => setFilter(cat)}
            label={CATEGORY_LABELS[cat]}
            count={assets.filter((a) => a.category === cat).length}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-slate-700">Asset</th>
              <th className="hidden px-4 py-3 font-semibold text-slate-700 sm:table-cell">Category</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-right">Value</th>
              <th className="px-4 py-3 font-semibold text-slate-700 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((asset) => {
              const value = asset.computedValue ?? asset.value;
              const isEquity =
                asset.category === "EQUITY_INDIAN" || asset.category === "EQUITY_FOREIGN";

              return (
                <tr key={asset.id} className="hover:bg-slate-50/80">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{asset.name}</p>
                    <AssetDetails asset={asset} />
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        CATEGORY_BADGE[asset.category]
                      )}
                    >
                      {CATEGORY_LABELS[asset.category]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <p className="font-semibold text-slate-900">
                      {formatCurrency(value, asset.currency)}
                    </p>
                    {asset.currency !== "INR" && (
                      <p className="text-xs text-slate-400">{asset.currency}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {isEquity && (
                        <button
                          onClick={() => onRevalue(asset.id)}
                          disabled={revaluingId === asset.id}
                          className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-amber-600 disabled:opacity-50"
                          title="Revalue"
                        >
                          <RefreshCw
                            className={cn("h-4 w-4", revaluingId === asset.id && "animate-spin")}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => onEdit(asset)}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                        title="Edit"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(asset.id)}
                        disabled={deletingId === asset.id}
                        className="rounded-lg p-2 text-slate-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <p className="p-8 text-center text-slate-500">No assets in this category.</p>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
        active
          ? "bg-slate-900 text-white"
          : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className={cn("ml-1", active ? "text-slate-300" : "text-slate-400")}>{count}</span>
      )}
    </button>
  );
}
