"use client";

import { X } from "lucide-react";
import { useOverlayDismiss } from "./useOverlayDismiss";

export function OverlaySheet({
  title,
  subtitle,
  onClose,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useOverlayDismiss(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
      <button className="absolute inset-0 bg-slate-900/30" aria-label="Close" onClick={onClose} />
      <aside className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:h-full sm:max-h-none sm:rounded-none">
        <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="min-w-0 pr-3">
            <div className="font-display text-xl font-semibold text-teal-dark">{title}</div>
            {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
          </div>
          <button className="btn-ghost shrink-0 px-2" onClick={onClose} type="button" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        <div className="border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {footer ?? (
            <button type="button" className="btn-secondary w-full" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </aside>
    </div>
  );
}
