"use client";

import { useAdminData } from "@/components/admin/AdminDataProvider";
import { useToast } from "@/components/admin/Toast";
import { formatDateTime } from "@/lib/datetime";
import { apiFetch, errorFromHttpResponse } from "@/lib/api-client";

export default function BlocksPage() {
  const { snapshot, removeBlock } = useAdminData();
  const toast = useToast();
  const blocks = snapshot.blocks.slice().sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  async function remove(id: string) {
    if (!confirm("Remove this closure?")) return;
    try {
      const res = await apiFetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.push(errorFromHttpResponse(res.status).message, "err");
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
          <div key={b.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="h-10 w-1.5 rounded-full bg-red-400" />
            <div className="min-w-0 flex-1">
              <div className="font-medium text-slate-800">{b.reason || "Closed"}</div>
              <div className="text-sm text-slate-500">
                {formatDateTime(new Date(b.startAt))} – {formatDateTime(new Date(b.endAt))}
                {b.allDay ? " · all day" : ""}
              </div>
            </div>
            <button className="btn-danger" onClick={() => remove(b.id)}>
              Unblock
            </button>
          </div>
        ))}
        {blocks.length === 0 && <p className="py-10 text-center text-sm text-slate-400">No closures on file</p>}
      </div>
    </div>
  );
}
