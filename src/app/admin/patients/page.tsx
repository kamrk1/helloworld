"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Phone, Search } from "lucide-react";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { displayPhone, telLink, waLink } from "@/lib/phone";
import { formatDateLong } from "@/lib/datetime";

export default function PatientsPage() {
  const { snapshot } = useAdminData();
  const [q, setQ] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snapshot.patients.filter(
      (p) =>
        !s ||
        p.name.toLowerCase().includes(s) ||
        p.phone.includes(s.replace(/\s/g, "")) ||
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
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            className="input pl-9"
            placeholder="Search name or phone"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
                <td className="px-4 py-3 text-slate-600">{displayPhone(p.phone)}</td>
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
        <div className="fixed inset-0 z-50 flex justify-end">
          <button className="absolute inset-0 bg-slate-900/30" onClick={() => setOpenId(null)} />
          <aside className="relative h-full w-full max-w-md overflow-y-auto bg-white p-5 shadow-2xl">
            <h2 className="font-display text-xl font-semibold text-teal-dark">{open.name}</h2>
            <p className="mt-1 text-sm text-slate-500">{displayPhone(open.phone)}</p>
            {open.email && <p className="text-sm text-slate-500">{open.email}</p>}
            {open.concerns && <p className="mt-2 text-sm text-slate-600">{open.concerns}</p>}
            <div className="mt-4 flex gap-2">
              <a className="btn-primary flex-1" href={telLink(open.phone)}>
                <Phone className="h-4 w-4" /> Call
              </a>
              <a className="btn-secondary flex-1" href={waLink(open.phone)} target="_blank" rel="noreferrer">
                <MessageCircle className="h-4 w-4" /> WhatsApp
              </a>
            </div>
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
          </aside>
        </div>
      )}
    </div>
  );
}
