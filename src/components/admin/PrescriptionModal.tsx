"use client";

import { useEffect, useState } from "react";
import { Modal } from "./Modal";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import type { AppointmentDTO, PrescriptionDTO } from "@/lib/types";
import { formatDateLong, toISODateIST } from "@/lib/datetime";
import { CLINIC } from "@/lib/clinic-config";
import { apiJson } from "@/lib/api-client";

export function PrescriptionModal({
  appointment,
  onClose,
}: {
  appointment: AppointmentDTO;
  onClose: () => void;
}) {
  const { upsertAppointment } = useAdminData();
  const toast = useToast();
  const [complaints, setComplaints] = useState("");
  const [findings, setFindings] = useState("");
  const [diagnosis, setDiagnosis] = useState("");
  const [medicines, setMedicines] = useState("");
  const [advice, setAdvice] = useState("");
  const [followupNote, setFollowupNote] = useState("");
  const [followupDate, setFollowupDate] = useState(
    appointment.followupDate ? toISODateIST(new Date(appointment.followupDate)) : "",
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/appointments/${appointment.id}/prescription`)
      .then((r) => (r.ok ? r.json() : null))
      .then((rx: PrescriptionDTO | null) => {
        if (!rx) return;
        setComplaints(rx.complaints);
        setFindings(rx.findings);
        setDiagnosis(rx.diagnosis);
        setMedicines(rx.medicines);
        setAdvice(rx.advice);
        setFollowupNote(rx.followupNote ?? "");
      })
      .catch(() => undefined);
  }, [appointment.id]);

  async function save(printAfter: boolean) {
    setBusy(true);
    try {
      const json = await apiJson<{ appointment: AppointmentDTO }>(
        `/api/admin/appointments/${appointment.id}/prescription`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            complaints,
            findings,
            diagnosis,
            medicines,
            advice,
            followupNote: followupNote || null,
            followupDate: followupDate ? `${followupDate}T10:00:00+05:30` : null,
          }),
        },
      );
      upsertAppointment(json.appointment);
      toast.push("Prescription saved");
      if (printAfter) {
        window.open(`/admin/print/rx/${appointment.id}?print=1`, "_blank");
      }
      onClose();
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Failed", "err");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Prescription" onClose={onClose} wide>
      <p className="mb-4 text-sm text-slate-500">
        {appointment.patientName} · {appointment.ref} · {formatDateLong(new Date(appointment.startAt))} ·{" "}
        {CLINIC.name}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label">Complaints</label>
          <textarea className="input min-h-[70px]" value={complaints} onChange={(e) => setComplaints(e.target.value)} />
        </div>
        <div>
          <label className="label">Findings</label>
          <textarea className="input min-h-[70px]" value={findings} onChange={(e) => setFindings(e.target.value)} />
        </div>
        <div>
          <label className="label">Diagnosis</label>
          <textarea className="input min-h-[70px]" value={diagnosis} onChange={(e) => setDiagnosis(e.target.value)} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Medicines (one per line)</label>
          <textarea
            className="input min-h-[90px]"
            value={medicines}
            onChange={(e) => setMedicines(e.target.value)}
            placeholder={"Amoxicillin 500mg 1-0-1 × 5 days\nIbuprofen 400mg SOS"}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Advice</label>
          <textarea className="input min-h-[70px]" value={advice} onChange={(e) => setAdvice(e.target.value)} />
        </div>
        <div>
          <label className="label">Follow-up note</label>
          <input className="input" value={followupNote} onChange={(e) => setFollowupNote(e.target.value)} />
        </div>
        <div>
          <label className="label">Follow-up date</label>
          <input className="input" type="date" value={followupDate} onChange={(e) => setFollowupDate(e.target.value)} />
        </div>
      </div>
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button className="btn-secondary" onClick={onClose} type="button">
          Cancel
        </button>
        <button className="btn-secondary" disabled={busy} onClick={() => save(false)}>
          Save
        </button>
        <button className="btn-primary" disabled={busy} onClick={() => save(true)}>
          Save & print / PDF
        </button>
      </div>
    </Modal>
  );
}
