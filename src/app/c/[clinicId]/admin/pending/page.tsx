"use client";

import { useAdminData } from "@/components/admin/AdminDataProvider";
import { useToast } from "@/components/admin/Toast";
import { formatDateTime } from "@/lib/datetime";
import { displayPhone, hasMobile, waLink } from "@/lib/phone";
import { MessageCircle } from "lucide-react";
import type { AppointmentDTO } from "@/lib/types";
import { apiJson } from "@/lib/api-client";

export default function PendingPage() {
  const { snapshot, upsertAppointment } = useAdminData();
  const toast = useToast();
  const clinic = snapshot.clinic;
  if (!clinic.flags.pendingApproval) {
    return <p className="px-4 py-10 text-center text-sm text-slate-400">Pending approvals are not in this clinic package.</p>;
  }
  const pending = snapshot.appointments
    .filter((a) => a.status === "PENDING")
    .sort((a, b) => +new Date(a.startAt) - +new Date(b.startAt));

  async function setStatus(a: AppointmentDTO, status: "APPROVED" | "REJECTED") {
    const prev = a;
    upsertAppointment({ ...a, status });
    try {
      const json = await apiJson<AppointmentDTO>(`/api/admin/appointments/${a.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      upsertAppointment(json);
      toast.push(status === "APPROVED" ? "Approved" : "Rejected");
    } catch (err) {
      upsertAppointment(prev);
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <h1 className="font-display text-2xl font-semibold text-teal-dark">Pending approvals</h1>
      <p className="mt-1 text-sm text-slate-500">Public bookings waiting for a yes or no.</p>
      <div className="mt-4 space-y-3">
        {pending.map((a) => (
          <div key={a.id} className="card px-4 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-slate-800">{a.patientName}</div>
                <div className="text-sm text-slate-500">
                  {a.service} · {formatDateTime(new Date(a.startAt))} · {a.durationMin} min
                </div>
                {hasMobile(a.phone) && <div className="text-sm text-slate-500">{displayPhone(a.phone)}</div>}
                {a.notes && <p className="mt-2 text-sm text-slate-600">{a.notes}</p>}
              </div>
              <div className="flex flex-wrap gap-2">
                {clinic.flags.whatsapp && hasMobile(a.phone) && (
                  <a
                    className="btn-secondary"
                    href={waLink(a.phone, `Hello ${a.patientName}, ${clinic.name} here about ${a.ref}.`)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="h-4 w-4" /> WhatsApp
                  </a>
                )}
                <button className="btn-primary" onClick={() => setStatus(a, "APPROVED")}>
                  Approve
                </button>
                <button className="btn-danger" onClick={() => setStatus(a, "REJECTED")}>
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
        {pending.length === 0 && (
          <p className="py-10 text-center text-sm text-slate-400">No pending bookings</p>
        )}
      </div>
    </div>
  );
}
