"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PatientDTO } from "@/lib/types";
import { displayPhone } from "@/lib/phone";

export function PatientTypeahead({
  patients,
  name,
  phone,
  onPick,
  onChange,
}: {
  patients: PatientDTO[];
  name: string;
  phone: string;
  onPick: (p: PatientDTO) => void;
  onChange: (next: { name?: string; phone?: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  const q = (name + " " + phone).trim().toLowerCase();
  const matches = useMemo(() => {
    if (q.length < 1) return patients.slice(0, 8);
    return patients
      .filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.phone.includes(q.replace(/\s/g, "")) ||
          (p.email ?? "").toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [patients, q]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={wrap} className="relative grid gap-3 sm:grid-cols-2">
      <div>
        <label className="label">Patient name</label>
        <input
          className="input"
          value={name}
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ name: e.target.value });
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (!open || !matches.length) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && matches[active]) {
              e.preventDefault();
              onPick(matches[active]);
              setOpen(false);
            }
          }}
          placeholder="Search or type a new name"
        />
      </div>
      <div>
        <label className="label">Phone</label>
        <input
          className="input"
          value={phone}
          inputMode="tel"
          autoComplete="off"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            onChange({ phone: e.target.value });
            setOpen(true);
          }}
          placeholder="10-digit mobile"
        />
      </div>
      {open && matches.length > 0 && (
        <div className="absolute left-0 right-0 top-[4.6rem] z-20 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          {matches.map((p, i) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                onPick(p);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                i === active ? "bg-teal-light" : "hover:bg-slate-50"
              }`}
            >
              <span className="font-medium text-slate-800">{p.name}</span>
              <span className="text-xs text-slate-500">{displayPhone(p.phone)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
