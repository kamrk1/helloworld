"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone, Plus, Search } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { OverlaySheet } from "@/components/admin/OverlaySheet";
import { Modal } from "@/components/admin/Modal";
import { useToast } from "@/components/admin/Toast";
import { displayPhone, hasMobile, isValidPhone, normalizePhone, telLink, waLink } from "@/lib/phone";
import { formatDateLong } from "@/lib/datetime";
import { apiJson } from "@/lib/api-client";
import type { PatientDTO } from "@/lib/types";

export default function PatientsPage() {
  const { snapshot, upsertPatient } = useAdminData();
  const clinic = snapshot.clinic;
  const toast = useToast();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snapshot.patients.filter(
      (p) =>
        !s ||
        p.name.toLowerCase().includes(s) ||
        (p.phone ?? "").includes(s.replace(/\s/g, "")) ||
        (p.email ?? "").toLowerCase().includes(s),
    );
  }, [snapshot.patients, q]);

  const open = snapshot.patients.find((p) => p.id === openId);
  const history = snapshot.appointments
    .filter((a) => a.patientId === openId)
    .slice()
    .sort((a, b) => +new Date(b.startAt) - +new Date(a.startAt));

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold text-teal-dark">Patients</h1>
          <p className="text-sm text-slate-500">{snapshot.patients.length} on file</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              className="input pl-9"
              placeholder="Search name or phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <button type="button" className="btn-primary" onClick={() => setAdding(true)}>
            <Plus className="h-4 w-4" /> Add patient
          </button>
        </div>
      </div>
      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-teal-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Name</th>
              <th className="px-4 py-2.5 font-semibold">Phone</th>
              <th className="hidden px-4 py-2.5 font-semibold sm:table-cell">Last visit</th>
              <th className="px-4 py-2.5 font-semibold">Visits</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="cursor-pointer border-t border-slate-100 hover:bg-teal-50/50"
                onClick={() => setOpenId(p.id)}
              >
                <td className="px-4 py-3 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-3 text-slate-600">{displayPhone(p.phone) || "—"}</td>
                <td className="hidden px-4 py-3 text-slate-500 sm:table-cell">
                  {p.lastVisit ? formatDateLong(new Date(p.lastVisit)) : "—"}
                </td>
                <td className="px-4 py-3">{p.totalBookings}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="px-4 py-8 text-center text-sm text-slate-400">No matching patients</p>}
      </div>

      {open && (
        <OverlaySheet
          title={open.name}
          subtitle={displayPhone(open.phone) || "No mobile on file"}
          onClose={() => setOpenId(null)}
        >
          {open.email && <p className="text-sm text-slate-500">{open.email}</p>}
          {open.concerns && <p className="mt-2 text-sm text-slate-600">{open.concerns}</p>}
          {hasMobile(open.phone) && (
          <div className="mt-4 flex gap-2">
            <a className="btn-primary flex-1" href={telLink(open.phone!)}>
              <Phone className="h-4 w-4" /> Call
            </a>
            {clinic.flags.whatsapp && (
              <a className="btn-secondary flex-1" href={waLink(open.phone!)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            )}
          </div>
          )}
          <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-slate-400">History</h3>
          <ul className="mt-2 space-y-2">
            {history.map((a) => (
              <li key={a.id} className="rounded-xl border border-slate-100 px-3 py-2 text-sm">
                <div className="font-medium">{a.service}</div>
                <div className="text-xs text-slate-500">
                  {formatDateLong(new Date(a.startAt))} · {a.status} · {a.ref}
                </div>
              </li>
            ))}
          </ul>
        </OverlaySheet>
      )}
      {adding && (
        <AddPatientModal
          onClose={() => setAdding(false)}
          onCreated={(p) => {
            upsertPatient(p);
            toast.push("Patient added");
            setAdding(false);
          }}
        />
      )}
    </div>
  );
}

function AddPatientModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (p: PatientDTO) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Patient name is required");
      return;
    }
    if (phone.trim() && !isValidPhone(phone)) {
      setError("Enter a 10-digit mobile number");
      return;
    }
    setBusy(true);
    try {
      const json = await apiJson<PatientDTO>("/api/admin/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() ? normalizePhone(phone) : undefined,
          email: email.trim() || undefined,
        }),
      });
      onCreated(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not add patient");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Add patient" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">Patient name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Walk-in name" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input
            className="input"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="optional"
            inputMode="tel"
          />
        </div>
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
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy}>
            {busy ? "Saving…" : "Save patient"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
