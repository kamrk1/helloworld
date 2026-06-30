"use client";

import { useCallback, useEffect, useState } from "react";
import type { Asset } from "@/lib/types";
import type { NetWorthSummary } from "@/lib/types";
import { CategoryCard, TotalHero } from "@/components/CategorySummary";
import { AssetList } from "@/components/AssetList";
import { AssetFormModal } from "@/components/AssetFormModal";
import { Plus, RefreshCw, TrendingUp } from "lucide-react";

type EnrichedAsset = Asset & { computedValue?: number };

export function Dashboard() {
  const [summary, setSummary] = useState<NetWorthSummary | null>(null);
  const [assets, setAssets] = useState<EnrichedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [revaluing, setRevaluing] = useState(false);
  const [revaluingId, setRevaluingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const refresh = useCallback(async () => {
    const [summaryRes, assetsRes] = await Promise.all([
      fetch("/api/summary"),
      fetch("/api/assets"),
    ]);
    const [summaryData, assetsData] = await Promise.all([
      summaryRes.json(),
      assetsRes.json(),
    ]);
    setSummary(summaryData);
    setAssets(assetsData);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleSave = async (data: Record<string, unknown>) => {
    const url = editingAsset ? `/api/assets/${editingAsset.id}` : "/api/assets";
    const method = editingAsset ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Save failed");
    }
    await refresh();
    showToast(editingAsset ? "Asset updated" : "Asset added");
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/assets/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Delete failed");
    await refresh();
    showToast("Asset deleted");
  };

  const handleRevalue = async (assetId?: string) => {
    if (assetId) setRevaluingId(assetId);
    else setRevaluing(true);

    try {
      const res = await fetch("/api/assets/revalue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assetId ? { assetIds: [assetId] } : {}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Revaluation failed");
      await refresh();
      showToast(data.message ?? "Revaluation complete");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Revaluation failed");
    } finally {
      setRevaluing(false);
      setRevaluingId(null);
    }
  };

  const equityCount = assets.filter(
    (a) => a.category === "EQUITY_INDIAN" || a.category === "EQUITY_FOREIGN"
  ).length;

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm text-white shadow-lg">
          {toast}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900">
            <TrendingUp className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Net Worth Calculator</h1>
            <p className="text-sm text-slate-500">Track cash, equities, savings, bank accounts & PF</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {equityCount > 0 && (
            <button
              onClick={() => handleRevalue()}
              disabled={revaluing}
              className="btn-secondary inline-flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${revaluing ? "animate-spin" : ""}`} />
              Revalue All Equities
            </button>
          )}
          <button
            onClick={() => {
              setEditingAsset(null);
              setFormOpen(true);
            }}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Asset
          </button>
        </div>
      </div>

      {summary && (
        <>
          <TotalHero
            totalInr={summary.totalInr}
            assetCount={assets.length}
            lastUpdated={summary.lastUpdated}
          />

          {summary.categories.filter((c) => c.count > 0).length > 0 && (
            <section>
              <h2 className="mb-4 text-lg font-semibold text-slate-800">By Category</h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {summary.categories
                  .filter((c) => c.count > 0)
                  .map((cat) => (
                    <CategoryCard
                      key={cat.category}
                      category={cat.category}
                      label={cat.label}
                      totalInr={cat.totalInr}
                      count={cat.count}
                      overallTotal={summary.totalInr}
                    />
                  ))}
              </div>
            </section>
          )}
        </>
      )}

      <section>
        <h2 className="mb-4 text-lg font-semibold text-slate-800">All Assets</h2>
        <AssetList
          assets={assets}
          onEdit={(asset) => {
            setEditingAsset(asset);
            setFormOpen(true);
          }}
          onDelete={handleDelete}
          onRevalue={handleRevalue}
          revaluingId={revaluingId}
        />
      </section>

      <AssetFormModal
        open={formOpen}
        asset={editingAsset}
        onClose={() => {
          setFormOpen(false);
          setEditingAsset(null);
        }}
        onSave={handleSave}
      />
    </div>
  );
}
