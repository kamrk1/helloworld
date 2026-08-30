"use client";

import { X } from "lucide-react";
import { useOverlayDismiss } from "./useOverlayDismiss";

export function Modal({
  title,
  children,
  onClose,
  wide,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useOverlayDismiss(onClose);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
      <button className="absolute inset-0 bg-slate-900/40" aria-label="Close" onClick={onClose} />
      <div
        className={`relative z-10 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${
          wide ? "sm:max-w-2xl" : "sm:max-w-lg"
        }`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-white px-5 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <h2 className="font-display text-lg font-semibold text-teal-dark">{title}</h2>
          <button className="btn-ghost px-2" onClick={onClose} type="button" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {children}
        </div>
      </div>
    </div>
  );
}
