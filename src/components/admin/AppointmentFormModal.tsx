"use client";

import { useState } from "react";
import { Modal } from "./Modal";
import { PatientTypeahead } from "./PatientTypeahead";
import { useAdminData } from "./AdminDataProvider";
import { useToast } from "./Toast";
import { toHHMMIST, toISODateIST } from "@/lib/datetime";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import type { AppointmentDTO, PatientDTO } from "@/lib/types";
import { apiJson } from "@/lib/api-client";

export function AppointmentFormModal({
  start,
  appointment,
  onClose,
}: {
  start?: Date;
  appointment?: AppointmentDTO;
  onClose: () => void;
}) {
  const { snapshot, upsertAppointment, upsertPatient } = useAdminData();
  const clinic = snapshot.clinic;
  const toast = useToast();
  const initial = appointment
    ? new Date(appointment.startAt)
    : start ?? new Date();

  const [patientId, setPatientId] = useState(appointment?.patientId ?? "");
  const [name, setName] = useState(appointment?.patientName ?? "");
  const [phone, setPhone] = useState(appointment?.phone ?? "");
  const [email, setEmail] = useState(appointment?.email ?? "");
  const [service, setService] = useState(appointment?.service ?? clinic.services[0] ?? "Consultation");
  const [date, setDate] = useState(toISODateIST(initial));
  const [time, setTime] = useState(toHHMMIST(initial));
  const [durationMin, setDurationMin] = useState(appointment?.durationMin ?? clinic.defaultDuration);
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function pickPatient(p: PatientDTO) {
    setPatientId(p.id);
    setName(p.name);
    setPhone(p.phone);
    setEmail(p.email ?? "");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!patientId) {
      if (!name.trim()) {
        setError("Patient name is required");
        return;
      }
      if (!isValidPhone(phone)) {
        setError("Enter a 10-digit mobile number");
        return;
      }
    }
    if (!date || !time) {
      setError("Choose a date and time.");
      return;
    }
    const startAt = new Date(`${date}T${time}:00+05:30`);
    if (Number.isNaN(startAt.getTime())) {
      setError("Choose a date and time.");
      return;
    }
    const payload: Record<string, unknown> = {
      service,
      startAt: startAt.toISOString(),
      durationMin,
      notes: notes || null,
      status: appointment?.status ?? "APPROVED",
    };
    if (patientId) {
      payload.patientId = patientId;
      if (name.trim()) payload.name = name.trim();
      if (phone.trim()) payload.phone = normalizePhone(phone);
      if (email.trim()) payload.email = email.trim();
    } else {
      payload.name = name.trim();
      payload.phone = normalizePhone(phone);
      if (email.trim()) payload.email = email.trim();
    }
    setBusy(true);
    try {
      const url = appointment
        ? `/api/admin/appointments/${appointment.id}`
        : "/api/admin/appointments";
      const json = await apiJson<AppointmentDTO>(url, {
        method: appointment ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      upsertAppointment(json);
      const patient = snapshot.patients.find((p) => p.id === json.patientId);
      if (!patient) {
        upsertPatient({
          id: json.patientId,
          name: json.patientName,
          phone: json.phone,
          email: json.email,
          firstVisit: json.startAt,
          lastVisit: json.startAt,
          totalBookings: 1,
          concerns: json.service,
        });
      }
      toast.push(appointment ? "Appointment updated" : "Appointment booked");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={appointment ? `Edit ${appointment.ref}` : "New appointment"} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <PatientTypeahead
          patients={snapshot.patients}
          name={name}
          phone={phone}
          onPick={pickPatient}
          onChange={(n) => {
            if (n.name !== undefined) {
              setName(n.name);
              setPatientId("");
            }
            if (n.phone !== undefined) {
              setPhone(n.phone);
              setPatientId("");
            }
          }}
        />
        <div>
          <label className="label">Email</label>
          <input
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional"
          />
        </div>
        <div>
          <label className="label">Service / concern</label>
          <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
                  {clinic.services.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div>
            <label className="label">Time</label>
            <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} required step={clinic.slotMinutes * 60} />
          </div>
        </div>
        <div>
          <label className="label">Duration</label>
          <div className="flex gap-2">
            {clinic.durations.map((d) => (
              <button
                type="button"
                key={d}
                onClick={() => setDurationMin(d)}
                className={`flex-1 rounded-lg border py-2 text-sm font-semibold ${
                  durationMin === d
                    ? "border-teal bg-teal text-white"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {d} min
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="label">Notes</label>
          <textarea
            className="input min-h-[72px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : appointment ? "Save changes" : "Book appointment"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
