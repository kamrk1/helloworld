"use client";

import { useState } from "react";
import { MessageCircle, Phone, Printer, Trash2, X } from "lucide-react";
import type { AppointmentDTO, BlockDTO } from "@/lib/types";
import type { AppointmentStatus } from "@/lib/clinic-config";
import { displayPhone, telLink, waLink } from "@/lib/phone";
import { formatDateTime, toISODateIST } from "@/lib/datetime";
import { STATUS_LABEL, statusClass } from "@/lib/status";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { apiJson, apiFetch, errorFromHttpResponse } from "@/lib/api-client";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { PrescriptionModal } from "./PrescriptionModal";
import { useOverlayDismiss } from "./useOverlayDismiss";

export function EventDrawer({
  appointment,
  block,
  onClose,
}: {
  appointment?: AppointmentDTO;
  block?: BlockDTO;
  onClose: () => void;
}) {
  const { upsertAppointment, removeAppointment, removeBlock, snapshot } = useAdminData();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [rx, setRx] = useState(false);
  const [follow, setFollow] = useState(
    appointment?.followupDate ? toISODateIST(new Date(appointment.followupDate)) : "",
  );
  const [busy, setBusy] = useState(false);

  useOverlayDismiss(onClose);

  async function setStatus(status: AppointmentStatus) {
    if (!appointment) return;
    setBusy(true);
    const prev = appointment;
    upsertAppointment({ ...appointment, status });
    try {
      const json = await apiJson<AppointmentDTO>(`/api/admin/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      upsertAppointment(json);
      toast.push(`Marked ${STATUS_LABEL[status].toLowerCase()}`);
    } catch (err) {
      upsertAppointment(prev);
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function saveFollowup() {
    if (!appointment) return;
    setBusy(true);
    try {
      const json = await apiJson<AppointmentDTO>(`/api/admin/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ followupDate: follow ? `${follow}T10:00:00+05:30` : null }),
      });
      upsertAppointment(json);
      toast.push(follow ? "Follow-up saved" : "Follow-up cleared");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function destroyAppt() {
    if (!appointment) return;
    if (!confirm(`Delete ${appointment.ref}?`)) return;
    setBusy(true);
    try {
      const res = await apiFetch(`/api/admin/appointments/${appointment.id}`, { method: "DELETE" });
      if (!res.ok) throw errorFromHttpResponse(res.status);
      removeAppointment(appointment.id);
      toast.push("Appointment deleted");
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function destroyBlock() {
    if (!block) return;
    if (!confirm("Remove this clinic block?")) return;
    try {
      const res = await apiFetch(`/api/admin/blocks/${block.id}`, { method: "DELETE" });
      if (!res.ok) {
        toast.push(errorFromHttpResponse(res.status).message, "err");
        return;
      }
      removeBlock(block.id);
      toast.push("Block removed");
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Could not remove block", "err");
    }
  }

  const live = appointment
    ? snapshot.appointments.find((a) => a.id === appointment.id) ?? appointment
    : undefined;
  const clinic = snapshot.clinic;
  const flags = clinic.flags;
  const reviewUrl = clinic.reviewUrl;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-end justify-end sm:items-stretch">
        <button className="absolute inset-0 bg-slate-900/30" aria-label="Close" onClick={onClose} />
        <aside className="relative z-10 flex max-h-[90dvh] w-full max-w-md flex-col rounded-t-2xl bg-white shadow-2xl sm:h-full sm:max-h-none sm:rounded-none">
          <div className="flex items-start justify-between border-b border-slate-100 px-5 pb-4 pt-[max(1rem,env(safe-area-inset-top))]">
            <div>
              <div className="font-display text-xl font-semibold text-teal-dark">
                {live ? live.patientName : "Clinic closed"}
              </div>
              <div className="mt-1 text-sm text-slate-500">
                {live
                  ? `${formatDateTime(new Date(live.startAt))} · ${live.durationMin} min`
                  : block
                    ? `${formatDateTime(new Date(block.startAt))} – ${formatDateTime(new Date(block.endAt))}`
                    : ""}
              </div>
            </div>
            <button className="btn-ghost shrink-0 px-2" onClick={onClose} type="button" aria-label="Close">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
            {live && (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`badge ${statusClass(live.status)}`}>{STATUS_LABEL[live.status]}</span>
                  <span className="text-xs font-medium text-slate-400">{live.ref}</span>
                </div>
                <div className="card p-4 text-sm">
                  <div className="font-semibold text-slate-800">{live.service}</div>
                  <div className="mt-2 text-slate-600">{displayPhone(live.phone)}</div>
                  {live.email && <div className="text-slate-500">{live.email}</div>}
                  {live.notes && <p className="mt-3 text-slate-600">{live.notes}</p>}
                </div>
                <div className="flex gap-2">
                  <a className="btn-primary flex-1" href={telLink(live.phone)}>
                    <Phone className="h-4 w-4" /> Call
                  </a>
                  {flags.whatsapp && (
                    <a
                      className="btn-secondary flex-1"
                      href={waLink(
                        live.phone,
                        `Hello ${live.patientName}, this is ${clinic.name} regarding your appointment ${live.ref} on ${formatDateTime(new Date(live.startAt))}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                </div>
                {live.status === "PENDING" && (
                  <div className="flex gap-2">
                    <button className="btn-primary flex-1" disabled={busy} onClick={() => setStatus("APPROVED")}>
                      Approve
                    </button>
                    <button className="btn-danger flex-1" disabled={busy} onClick={() => setStatus("REJECTED")}>
                      Reject
                    </button>
                  </div>
                )}
                {live.status === "APPROVED" && (
                  <button className="btn-primary w-full" disabled={busy} onClick={() => setStatus("CONFIRMED")}>
                    Mark confirmed
                  </button>
                )}
                {(live.status === "APPROVED" || live.status === "CONFIRMED") && (
                  <button className="btn-secondary w-full" disabled={busy} onClick={() => setStatus("CANCELLED")}>
                    Cancel visit
                  </button>
                )}
                {flags.followUps && (
                <div>
                  <label className="label">Follow-up date</label>
                  <div className="flex gap-2">
                    <input
                      className="input"
                      type="date"
                      value={follow}
                      onChange={(e) => setFollow(e.target.value)}
                    />
                    <button className="btn-secondary shrink-0" onClick={saveFollowup} disabled={busy}>
                      Save
                    </button>
                  </div>
                </div>
                )}
                {reviewUrl && (
                  <a className="text-sm font-medium text-teal underline" href={reviewUrl} target="_blank" rel="noreferrer">
                    Request a Google review
                  </a>
                )}
              </>
            )}
            {block && (
              <div className="card p-4">
                <div className="text-sm font-semibold text-red-700">Blocked / clinic closure</div>
                <p className="mt-2 text-sm text-slate-600">{block.reason || "No reason noted"}</p>
                {block.allDay && <p className="mt-1 text-xs uppercase text-slate-400">All day</p>}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-slate-100 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Close
            </button>
            {live && (
              <>
                <button className="btn-secondary" onClick={() => setEditing(true)}>
                  Edit
                </button>
                {flags.prescriptions && (
                  <button className="btn-gold" onClick={() => setRx(true)}>
                    <Printer className="h-4 w-4" /> Rx
                  </button>
                )}
                <button className="btn-ghost ml-auto text-red-600" onClick={destroyAppt}>
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              </>
            )}
            {block && (
              <button className="btn-danger flex-1" onClick={destroyBlock}>
                Remove block
              </button>
            )}
          </div>
        </aside>
      </div>
      {editing && live && <AppointmentFormModal appointment={live} onClose={() => setEditing(false)} />}
      {rx && live && flags.prescriptions && (
        <PrescriptionModal appointment={live} onClose={() => setRx(false)} />
      )}
    </>
  );
}
