"use client";

import { useState } from "react";
import { MessageCircle, Phone, Printer, Trash2, X, Receipt } from "lucide-react";
import type { AppointmentDTO, BlockDTO } from "@/lib/types";
import type { AppointmentStatus } from "@/lib/clinic-config";
import { displayPhone, hasMobile, telLink, waLink } from "@/lib/phone";
import { formatDateTime, toISODateIST } from "@/lib/datetime";
import { STATUS_LABEL, statusClass } from "@/lib/status";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { apiJson, apiFetch, errorFromHttpResponse } from "@/lib/api-client";
import { AppointmentFormModal } from "./AppointmentFormModal";
import { PrescriptionModal } from "./PrescriptionModal";
import { InvoiceModal } from "./InvoiceModal";
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
  const { upsertAppointment, removeAppointment, upsertBlock, removeBlock, snapshot } = useAdminData();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [rx, setRx] = useState(false);
  const [invoice, setInvoice] = useState(false);
  const [follow, setFollow] = useState(
    appointment?.followupDate ? toISODateIST(new Date(appointment.followupDate)) : "",
  );
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
    const id = appointment.id;
    const prev = appointment;
    removeAppointment(id);
    onClose();
    try {
      const res = await apiFetch(`/api/admin/appointments/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        upsertAppointment(prev);
        toast.push(errorFromHttpResponse(res.status, body.error).message, "err");
        return;
      }
      toast.push("Appointment deleted");
    } catch (err) {
      upsertAppointment(prev);
      toast.push(err instanceof Error ? err.message : "Could not delete appointment", "err");
    }
  }

  async function destroyBlock() {
    if (!block) return;
    const prev = block;
    const id = block.id;
    removeBlock(id);
    onClose();
    try {
      const res = await apiFetch(`/api/admin/blocks/${id}`, { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        upsertBlock(prev);
        toast.push(errorFromHttpResponse(res.status, body.error).message, "err");
        return;
      }
      toast.push("Block removed");
    } catch (err) {
      upsertBlock(prev);
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
                  {hasMobile(live.phone) && (
                    <div className="mt-2 text-slate-600">{displayPhone(live.phone)}</div>
                  )}
                  {live.email && <div className="text-slate-500">{live.email}</div>}
                  {live.notes && <p className="mt-3 text-slate-600">{live.notes}</p>}
                </div>
                {hasMobile(live.phone) && (
                <div className="flex gap-2">
                  <a className="btn-primary flex-1" href={telLink(live.phone!)}>
                    <Phone className="h-4 w-4" /> Call
                  </a>
                  {flags.whatsapp && (
                    <a
                      className="btn-secondary flex-1"
                      href={waLink(
                        live.phone!,
                        `Hello ${live.patientName}, this is ${clinic.name} regarding your appointment ${live.ref} on ${formatDateTime(new Date(live.startAt))}.`,
                      )}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <MessageCircle className="h-4 w-4" /> WhatsApp
                    </a>
                  )}
                </div>
                )}
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
                <button type="button" className="btn-secondary" onClick={() => setEditing(true)}>
                  Edit
                </button>
                {flags.prescriptions && (
                  <button type="button" className="btn-gold" onClick={() => setRx(true)}>
                    <Printer className="h-4 w-4" /> Rx
                  </button>
                )}
                <button type="button" className="btn-gold" onClick={() => setInvoice(true)}>
                  <Receipt className="h-4 w-4" /> Bill
                </button>
                {confirmDelete ? (
                  <div className="ml-auto flex min-w-0 flex-1 items-center justify-end gap-2">
                    <span className="hidden text-xs text-slate-500 sm:inline">Delete {live.ref}?</span>
                    <button
                      type="button"
                      className="btn-secondary px-2.5"
                      disabled={busy}
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep
                    </button>
                    <button
                      type="button"
                      className="btn-secondary border-slate-400 px-2.5 text-slate-800"
                      disabled={busy}
                      onClick={() => void destroyAppt()}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="btn-ghost ml-auto text-red-700"
                    disabled={busy}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setConfirmDelete(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" /> Delete
                  </button>
                )}
              </>
            )}
            {block && (
              confirmDelete ? (
                <div className="flex w-full items-center justify-end gap-2">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setConfirmDelete(false)}
                  >
                    Keep
                  </button>
                  <button
                    type="button"
                    className="btn-secondary border-slate-500 text-slate-800"
                    onClick={() => void destroyBlock()}
                  >
                    Remove block
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-secondary flex-1 border-slate-400 text-slate-700"
                  onClick={() => setConfirmDelete(true)}
                >
                  Remove block
                </button>
              )
            )}
          </div>
        </aside>
      </div>
      {editing && live && <AppointmentFormModal appointment={live} onClose={() => setEditing(false)} />}
      {rx && live && flags.prescriptions && (
        <PrescriptionModal appointment={live} onClose={() => setRx(false)} />
      )}
      {invoice && live && <InvoiceModal appointment={live} onClose={() => setInvoice(false)} />}
    </>
  );
}
