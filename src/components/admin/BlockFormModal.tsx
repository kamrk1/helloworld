"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { toHHMMIST, toISODateIST } from "@/lib/datetime";
import type { BlockDTO } from "@/lib/types";

export function BlockFormModal({
  start,
  end,
  onClose,
}: {
  start: Date;
  end: Date;
  onClose: () => void;
}) {
  const { upsertBlock } = useAdminData();
  const toast = useToast();
  const [date, setDate] = useState(toISODateIST(start));
  const [timeFrom, setTimeFrom] = useState(toHHMMIST(start));
  const [timeTo, setTimeTo] = useState(toHHMMIST(end));
  const [allDay, setAllDay] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const startAt = allDay
      ? new Date(`${date}T00:00:00+05:30`)
      : new Date(`${date}T${timeFrom}:00+05:30`);
    const endAt = allDay
      ? new Date(`${date}T23:59:00+05:30`)
      : new Date(`${date}T${timeTo}:00+05:30`);
    try {
      const res = await fetch("/api/admin/blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ startAt: startAt.toISOString(), endAt: endAt.toISOString(), allDay, reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not create block");
      upsertBlock(json as BlockDTO);
      toast.push("Clinic block saved");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Block clinic hours" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-500">
          Drag-selected range is blocked for booking. Leave times empty (all day) to close the whole day.
        </p>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          Entire day closed
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">From</label>
              <input className="input" type="time" value={timeFrom} onChange={(e) => setTimeFrom(e.target.value)} required />
            </div>
            <div>
              <label className="label">To</label>
              <input className="input" type="time" value={timeTo} onChange={(e) => setTimeTo(e.target.value)} required />
            </div>
          </div>
        )}
        <div>
          <label className="label">Reason</label>
          <input
            className="input"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lunch, holiday, staff meeting…"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-danger" disabled={busy}>
            {busy ? "Saving…" : "Block this range"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
