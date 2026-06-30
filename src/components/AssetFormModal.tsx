"use client";

import { useEffect, useState } from "react";
import type { Asset, AssetCategory, BankAccountType, StockExchange } from "@/lib/types";
import {
  BANK_ACCOUNT_LABELS,
  CATEGORY_LABELS,
  CURRENCY_OPTIONS,
  EXCHANGE_LABELS,
} from "@/lib/types";
import { X } from "lucide-react";

export interface AssetFormData {
  name: string;
  category: AssetCategory;
  currency: string;
  notes: string;
  value: string;
  bankName: string;
  accountType: BankAccountType | "";
  symbol: string;
  quantity: string;
  purchasePrice: string;
  currentPrice: string;
  fees: string;
  exchange: StockExchange | "";
  principal: string;
  interestRate: string;
  startDate: string;
  monthlyContribution: string;
}

const EMPTY_FORM: AssetFormData = {
  name: "",
  category: "CASH",
  currency: "INR",
  notes: "",
  value: "",
  bankName: "",
  accountType: "",
  symbol: "",
  quantity: "",
  purchasePrice: "",
  currentPrice: "",
  fees: "0",
  exchange: "NSE",
  principal: "",
  interestRate: "",
  startDate: "",
  monthlyContribution: "",
};

function assetToForm(asset: Asset): AssetFormData {
  const startDate =
    asset.startDate != null
      ? new Date(asset.startDate).toISOString().slice(0, 10)
      : "";

  return {
    name: asset.name,
    category: asset.category,
    currency: asset.currency,
    notes: asset.notes ?? "",
    value: String(asset.value),
    bankName: asset.bankName ?? "",
    accountType: asset.accountType ?? "",
    symbol: asset.symbol ?? "",
    quantity: asset.quantity != null ? String(asset.quantity) : "",
    purchasePrice: asset.purchasePrice != null ? String(asset.purchasePrice) : "",
    currentPrice: asset.currentPrice != null ? String(asset.currentPrice) : "",
    fees: String(asset.fees ?? 0),
    exchange: asset.exchange ?? (asset.category === "EQUITY_FOREIGN" ? "NASDAQ" : "NSE"),
    principal: asset.principal != null ? String(asset.principal) : "",
    interestRate: asset.interestRate != null ? String(asset.interestRate) : "",
    startDate,
    monthlyContribution:
      asset.monthlyContribution != null ? String(asset.monthlyContribution) : "",
  };
}

interface AssetFormModalProps {
  open: boolean;
  asset?: Asset | null;
  onClose: () => void;
  onSave: (data: Record<string, unknown>) => Promise<void>;
}

export function AssetFormModal({ open, asset, onClose, onSave }: AssetFormModalProps) {
  const [form, setForm] = useState<AssetFormData>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(asset ? assetToForm(asset) : EMPTY_FORM);
      setError(null);
    }
  }, [open, asset]);

  if (!open) return null;

  const isEquity = form.category === "EQUITY_INDIAN" || form.category === "EQUITY_FOREIGN";
  const isPf = form.category === "PF";
  const isBank = form.category === "BANK_ACCOUNT";
  const isSavings = form.category === "SAVINGS";
  const isSimple = form.category === "CASH" || isSavings || isBank;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: form.name,
      category: form.category,
      currency: form.currency,
      notes: form.notes || null,
    };

    if (isSimple) {
      payload.value = parseFloat(form.value) || 0;
      if (isBank || isSavings) payload.bankName = form.bankName || null;
      if (isBank) payload.accountType = form.accountType || null;
    }

    if (isEquity) {
      payload.symbol = form.symbol.toUpperCase();
      payload.quantity = parseFloat(form.quantity) || 0;
      payload.purchasePrice = form.purchasePrice ? parseFloat(form.purchasePrice) : null;
      payload.currentPrice = form.currentPrice ? parseFloat(form.currentPrice) : null;
      payload.fees = parseFloat(form.fees) || 0;
      payload.exchange = form.exchange || null;
      payload.value = 0;
    }

    if (isPf) {
      payload.principal = parseFloat(form.principal) || 0;
      payload.interestRate = parseFloat(form.interestRate) || 0;
      payload.monthlyContribution = form.monthlyContribution
        ? parseFloat(form.monthlyContribution)
        : null;
      payload.startDate = form.startDate
        ? new Date(form.startDate).toISOString()
        : null;
      payload.value = 0;
    }

    try {
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const set = (field: keyof AssetFormData, value: string) =>
    setForm((f) => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {asset ? "Edit Asset" : "Add Asset"}
          </h2>
          <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-slate-100">
            <X className="h-5 w-5 text-slate-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
          )}

          <Field label="Name" required>
            <input
              className="input"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. HDFC Savings, Reliance shares"
              required
            />
          </Field>

          <Field label="Category" required>
            <select
              className="input"
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
            >
              {(Object.keys(CATEGORY_LABELS) as AssetCategory[]).map((cat) => (
                <option key={cat} value={cat}>
                  {CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Currency">
            <select className="input" value={form.currency} onChange={(e) => set("currency", e.target.value)}>
              {CURRENCY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          {isSimple && (
            <>
              <Field label="Amount" required>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                  required
                />
              </Field>
              {(isBank || isSavings) && (
                <Field label="Bank Name">
                  <input
                    className="input"
                    value={form.bankName}
                    onChange={(e) => set("bankName", e.target.value)}
                    placeholder="e.g. HDFC Bank, SBI"
                  />
                </Field>
              )}
              {isBank && (
                <Field label="Account Type" required>
                  <select
                    className="input"
                    value={form.accountType}
                    onChange={(e) => set("accountType", e.target.value)}
                    required
                  >
                    <option value="">Select type</option>
                    {(Object.keys(BANK_ACCOUNT_LABELS) as BankAccountType[]).map((t) => (
                      <option key={t} value={t}>
                        {BANK_ACCOUNT_LABELS[t]}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </>
          )}

          {isEquity && (
            <>
              <Field label="Stock Symbol" required>
                <input
                  className="input"
                  value={form.symbol}
                  onChange={(e) => set("symbol", e.target.value)}
                  placeholder={form.category === "EQUITY_INDIAN" ? "e.g. RELIANCE" : "e.g. AAPL"}
                  required
                />
              </Field>
              <Field label="Exchange" required>
                <select
                  className="input"
                  value={form.exchange}
                  onChange={(e) => set("exchange", e.target.value)}
                >
                  {(Object.keys(EXCHANGE_LABELS) as StockExchange[]).map((ex) => (
                    <option key={ex} value={ex}>
                      {EXCHANGE_LABELS[ex]}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Quantity" required>
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="any"
                    value={form.quantity}
                    onChange={(e) => set("quantity", e.target.value)}
                    required
                  />
                </Field>
                <Field label="Fees (brokerage, etc.)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.fees}
                    onChange={(e) => set("fees", e.target.value)}
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Purchase Price">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(e) => set("purchasePrice", e.target.value)}
                  />
                </Field>
                <Field label="Current Price (manual)">
                  <input
                    className="input"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.currentPrice}
                    onChange={(e) => set("currentPrice", e.target.value)}
                    placeholder="Or use Revalue"
                  />
                </Field>
              </div>
              <p className="text-xs text-slate-500">
                Use &quot;Revalue All Equities&quot; to fetch live prices from Yahoo Finance (free).
              </p>
            </>
          )}

          {isPf && (
            <>
              <Field label="Principal Amount" required>
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.principal}
                  onChange={(e) => set("principal", e.target.value)}
                  required
                />
              </Field>
              <Field label="Annual Interest Rate (%)" required>
                <input
                  className="input"
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={form.interestRate}
                  onChange={(e) => set("interestRate", e.target.value)}
                  placeholder="e.g. 8.15 for EPF"
                  required
                />
              </Field>
              <Field label="Start Date">
                <input
                  className="input"
                  type="date"
                  value={form.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                />
              </Field>
              <Field label="Monthly Contribution">
                <input
                  className="input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyContribution}
                  onChange={(e) => set("monthlyContribution", e.target.value)}
                  placeholder="Employee + employer contribution"
                />
              </Field>
              <p className="text-xs text-slate-500">
                PF value is auto-calculated (MTM) using compound monthly interest from start date.
              </p>
            </>
          )}

          <Field label="Notes">
            <textarea
              className="input min-h-[72px] resize-y"
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="Optional notes"
            />
          </Field>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Saving…" : asset ? "Update" : "Add Asset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
