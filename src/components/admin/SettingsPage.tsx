"use client";

import { useState } from "react";
import { useAdminData } from "@/components/admin/AdminDataProvider";
import { useToast } from "@/components/admin/Toast";
import type { AdminClinicDTO } from "@/lib/clinic-runtime";
import { FEATURE_FLAG_KEYS } from "@/lib/clinic-config";
import { apiJson } from "@/lib/api-client";
import { hoursFromRuntime, type HoursWindow } from "@/lib/clinic-hours";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function SettingsPage() {
  const { snapshot, setSnapshot } = useAdminData();
  const toast = useToast();
  const clinic = snapshot.clinic;
  const [name, setName] = useState(clinic.name);
  const [shortName, setShortName] = useState(clinic.shortName);
  const [tagline, setTagline] = useState(clinic.tagline);
  const [windows, setWindows] = useState<HoursWindow[]>(() => hoursFromRuntime(clinic.hours).windows);
  const [closedWeekdays, setClosedWeekdays] = useState<number[]>(clinic.closedWeekdays);
  const [slotMinutes, setSlotMinutes] = useState(clinic.slotMinutes);
  const [defaultDuration, setDefaultDuration] = useState(clinic.defaultDuration);
  const [durationsText, setDurationsText] = useState(clinic.durations.join(", "));
  const [servicesText, setServicesText] = useState(clinic.services.join("\n"));
  const [phone, setPhone] = useState(clinic.phone);
  const [address, setAddress] = useState(clinic.address);
  const [reviewUrl, setReviewUrl] = useState(clinic.reviewUrl);
  const [brandPrimary, setBrandPrimary] = useState(clinic.brand.primary);
  const [brandAccent, setBrandAccent] = useState(clinic.brand.accent);
  const [rx, setRx] = useState(clinic.rx);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);

  function applyClinic(next: AdminClinicDTO) {
    setSnapshot((prev) => ({ ...prev, clinic: next }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const durations = durationsText
        .split(/[,\s]+/)
        .map((n) => Number(n))
        .filter((n) => Number.isFinite(n) && n > 0);
      const services = servicesText
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const json = await apiJson<AdminClinicDTO>("/api/admin/clinic", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          shortName,
          tagline,
          hoursWindows: windows.map((w) => ({ start: w.start.slice(0, 5), end: w.end.slice(0, 5) })),
          closedWeekdays,
          slotMinutes,
          defaultDuration,
          durations: durations.length ? durations : [defaultDuration],
          services: services.length ? services : ["Consultation"],
          phone,
          address,
          reviewUrl,
          brandPrimary,
          brandAccent,
          rx,
        }),
      });
      applyClinic(json);
      setWindows(hoursFromRuntime(json.hours).windows);
      toast.push("Settings saved");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Save failed", "err");
    } finally {
      setBusy(false);
    }
  }

  async function uploadLogo(file: File) {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("logo", file);
      const res = await fetch("/api/admin/clinic/logo", { method: "POST", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(typeof json.error === "string" ? json.error : "Upload failed");
      applyClinic(json as AdminClinicDTO);
      toast.push("Logo updated");
    } catch (err) {
      toast.push(err instanceof Error ? err.message : "Upload failed", "err");
    } finally {
      setUploading(false);
    }
  }

  function toggleDay(day: number) {
    setClosedWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-3xl space-y-8 px-4 py-6 pb-28 md:pb-8">
      <div>
        <h1 className="font-display text-2xl font-semibold text-teal-dark">Clinic settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          These values drive public booking, the calendar grid, and Rx letterhead for this clinic only.
        </p>
      </div>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Identity</h2>
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={clinic.logoUrl} alt="" className="h-16 w-16 rounded-xl object-cover ring-1 ring-slate-200" />
          <div>
            <label className="btn-secondary cursor-pointer">
              {uploading ? "Uploading…" : "Upload logo"}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void uploadLogo(file);
                }}
              />
            </label>
            <p className="mt-1 text-xs text-slate-400">PNG, JPEG, WebP, or SVG · under 400 KB</p>
          </div>
        </div>
        <div>
          <label className="label">Clinic name</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Short name</label>
            <input className="input" value={shortName} onChange={(e) => setShortName(e.target.value)} />
          </div>
          <div>
            <label className="label">Clinic ID</label>
            <input className="input bg-slate-50" value={clinic.id} readOnly />
          </div>
        </div>
        <div>
          <label className="label">Tagline</label>
          <input className="input" value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Hours & slots</h2>
        <p className="text-sm text-slate-500">
          Add one window for a full day, or several for a lunch gap — e.g. 10:00–14:00 and 16:00–21:00.
        </p>
        <div className="space-y-2">
          <label className="label">Open windows</label>
          {windows.map((w, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input
                className="input max-w-[9rem]"
                type="time"
                value={w.start}
                onChange={(e) =>
                  setWindows((prev) => prev.map((row, j) => (j === i ? { ...row, start: e.target.value } : row)))
                }
              />
              <span className="text-slate-400">–</span>
              <input
                className="input max-w-[9rem]"
                type="time"
                value={w.end}
                onChange={(e) =>
                  setWindows((prev) => prev.map((row, j) => (j === i ? { ...row, end: e.target.value } : row)))
                }
              />
              <button
                type="button"
                className="btn-ghost px-2 text-sm"
                disabled={windows.length <= 1}
                onClick={() => setWindows((prev) => prev.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn-secondary text-sm"
            disabled={windows.length >= 8}
            onClick={() => setWindows((prev) => [...prev, { start: "16:00", end: "21:00" }])}
          >
            Add window
          </button>
        </div>
        <div>
          <label className="label">Closed weekdays</label>
          <div className="flex flex-wrap gap-2">
            {DAY_LABELS.map((label, i) => (
              <button
                type="button"
                key={label}
                onClick={() => toggleDay(i)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-semibold ${
                  closedWeekdays.includes(i)
                    ? "border-red-200 bg-red-50 text-red-700"
                    : "border-slate-200 bg-white text-slate-600"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Slot size (minutes)</label>
            <input
              className="input"
              type="number"
              min={5}
              max={120}
              value={slotMinutes}
              onChange={(e) => setSlotMinutes(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="label">Default visit duration</label>
            <input
              className="input"
              type="number"
              min={5}
              max={480}
              value={defaultDuration}
              onChange={(e) => setDefaultDuration(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <label className="label">Allowed durations (comma-separated minutes)</label>
          <input className="input" value={durationsText} onChange={(e) => setDurationsText(e.target.value)} />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Contact</h2>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div>
          <label className="label">Address</label>
          <input className="input" value={address} onChange={(e) => setAddress(e.target.value)} />
        </div>
        <div>
          <label className="label">Review URL</label>
          <input className="input" value={reviewUrl} onChange={(e) => setReviewUrl(e.target.value)} placeholder="https://g.page/…" />
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Brand</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Primary</label>
            <input className="input" value={brandPrimary} onChange={(e) => setBrandPrimary(e.target.value)} />
          </div>
          <div>
            <label className="label">Accent</label>
            <input className="input" value={brandAccent} onChange={(e) => setBrandAccent(e.target.value)} />
          </div>
        </div>
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Services</h2>
        <textarea
          className="input min-h-[140px]"
          value={servicesText}
          onChange={(e) => setServicesText(e.target.value)}
        />
      </section>

      <section className="card space-y-4 p-5">
        <h2 className="font-display text-lg text-teal-dark">Rx letterhead</h2>
        <div>
          <label className="label">Doctor name</label>
          <input className="input" value={rx.doctorName} onChange={(e) => setRx({ ...rx, doctorName: e.target.value })} />
        </div>
        <div>
          <label className="label">Qualifications</label>
          <input
            className="input"
            value={rx.qualifications}
            onChange={(e) => setRx({ ...rx, qualifications: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Registration no</label>
          <input
            className="input"
            value={rx.registrationNo}
            onChange={(e) => setRx({ ...rx, registrationNo: e.target.value })}
          />
        </div>
        <div>
          <label className="label">Footer / advice boilerplate</label>
          <textarea
            className="input min-h-[80px]"
            value={rx.footer}
            onChange={(e) => setRx({ ...rx, footer: e.target.value })}
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={rx.printLogo} onChange={(e) => setRx({ ...rx, printLogo: e.target.checked })} />
          Print logo on Rx
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={rx.printClinic}
            onChange={(e) => setRx({ ...rx, printClinic: e.target.checked })}
          />
          Print clinic name / address / phone on Rx
        </label>
      </section>

      <section className="card space-y-3 p-5">
        <h2 className="font-display text-lg text-teal-dark">Package (seller-controlled)</h2>
        <p className="text-sm text-slate-500">
          Feature flags are not editable by clinic staff. Ask the platform operator to change the package.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {FEATURE_FLAG_KEYS.map((key) => (
            <li key={key} className="rounded-lg border border-slate-100 px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">{key}</span>
              <span className={`ml-2 text-xs font-semibold ${clinic.flags[key] ? "text-teal" : "text-slate-400"}`}>
                {clinic.flags[key] ? "on" : "off"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="sticky bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 -mx-4 border-t border-slate-100 bg-ivory/95 px-4 py-3 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none">
        <button className="btn-primary w-full md:w-auto" disabled={busy} type="submit">
          {busy ? "Saving…" : "Save settings"}
        </button>
      </div>
    </form>
  );
}
