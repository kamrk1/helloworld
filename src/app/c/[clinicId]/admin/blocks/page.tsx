"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { useToast } from "@/components/admin/Toast";
import { formatDateTime } from "@/lib/datetime";
import { apiFetch, errorFromHttpResponse } from "@/lib/api-client";

export default function BlocksPage() {
  const { snapshot, removeBlock } = useAdminData();
  const toast = useToast();
  if (!snapshot.clinic.flags.closures) {
    return <p className="px-4 py-10 text-center text-sm text-slate-400">Closures are not in this clinic package.</p>;
  }
  const blocks = snapshot.blocks.slice().sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  async function remove(id: string) {
    try {
      const res = await apiFetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.push(errorFromHttpResponse(res.status, body.error).message, "err");
        return;
      }
      removeBlock(id);
      toast.push("Block removed");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not remove", "err");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-display text-2xl font-semibold text-teal-dark">Clinic closures</h1>
      <p className="mt-1 text-sm text-slate-500">
        Drag a range on the calendar to add a block. Blocked times cannot be booked.
      </p>
      <div className="mt-4 space-y-2">
        {blocks.map((b) => (
          <div
            key={b.id}
            className="card flex flex-wrap items-center gap-3 overflow-hidden px-4 py-3"
            style={{
              backgroundImage:
                "repeating-linear-gradient(-45deg, transparent, transparent 7px, rgba(100, 116, 139, 0.08) 7px, rgba(100, 116, 139, 0.08) 8px)",
            }}
          >
            <div className="h-10 w-1.5 rounded-full bg-slate-400" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">{b.reason || "Closed"}</div>
              <div className="text-sm text-slate-500">
                {formatDateTime(new Date(b.startAt))} – {formatDateTime(new Date(b.endAt))}
                {b.allDay ? " · all day" : ""}
              </div>
            </div>
            <UnblockButton id={b.id} onRemove={remove} />
          </div>
        ))}
        {blocks.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No closures on file</p>}
      </div>
    </div>
  );
}

function UnblockButton({ id, onRemove }: { id: string; onRemove: (id: string) => void | Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-secondary px-2.5"
          disabled={busy}
          onClick={() => setConfirming(false)}
        >
          Keep
        </button>
        <button
          type="button"
          className="btn-secondary border-slate-500 px-3 text-slate-800"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await onRemove(id);
            setBusy(false);
            setConfirming(false);
          }}
        >
          Unblock
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      className="btn-secondary border-slate-400 text-slate-700"
      onClick={() => setConfirming(true)}
    >
      Unblock
    </button>
  );
}
