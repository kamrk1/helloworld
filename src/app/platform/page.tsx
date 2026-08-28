"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { FEATURE_FLAG_KEYS, adminBase, bookingPath, type FeatureFlags } from "@/lib/clinic-config";

type ClinicRow = {
  id: string;
  name: string;
  shortName: string;
  enabled: boolean;
  hasPassword: boolean;
  hours: { start: string; end: string };
  defaultDuration: number;
  flags: FeatureFlags;
};

export default function PlatformHome() {
  const router = useRouter();
  const [clinics, setClinics] = useState<ClinicRow[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [hoursOpen, setHoursOpen] = useState("09:00");
  const [hoursClose, setHoursClose] = useState("17:00");
  const [defaultDuration, setDefaultDuration] = useState(15);
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");
  const [flags, setFlags] = useState<FeatureFlags>({
    publicBooking: true,
    pendingApproval: true,
    followUps: true,
    closures: true,
    prescriptions: true,
    whatsapp: true,
  });

  async function load() {
    try {
      const rows = await apiJson<ClinicRow[]>("/api/platform/clinics");
      setClinics(rows);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load clinics");
      if (err instanceof Error && err.message.toLowerCase().includes("unauthorized")) {
        router.replace("/platform/login");
      }
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createClinic(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/platform/clinics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug,
          name,
          password,
          hoursOpen,
          hoursClose,
          defaultDuration,
          slotMinutes: defaultDuration <= 15 ? 15 : 30,
          flags,
        }),
      });
      setSlug("");
      setName("");
      setPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent, id: string) {
    e.preventDefault();
    if (!resetPassword.trim()) return;
    setBusy(true);
    setError("");
    try {
      await apiJson(`/api/platform/clinics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: resetPassword }),
      });
      setResetFor(null);
      setResetPassword("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Password reset failed");
    } finally {
      setBusy(false);
    }
  }
  async function toggleEnabled(id: string, enabled: boolean) {
    try {
      await apiJson(`/api/platform/clinics/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/platform/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh bg-ivory px-4 py-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="font-display text-3xl font-semibold text-teal-dark">Clinics</h1>
            <p className="text-sm text-slate-500">Create tenants, set package flags, disable a clinic.</p>
            <p className="mt-1 text-sm text-slate-500">
              Staff passwords are hashed on <span className="font-medium">this host</span>. If a clinic cannot log in
              after a deploy, use <span className="font-medium">Reset password</span> here — not a laptop script.
            </p>
          </div>
          <button className="btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
        <div className="space-y-3">
          {clinics.map((c) => (
            <div key={c.id} className="card flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-800">
                  {c.name}{" "}
                  <span className="font-mono text-xs text-slate-400">{c.id}</span>
                  {!c.enabled && <span className="ml-2 text-xs font-semibold text-red-600">disabled</span>}
                </div>
                <div className="text-sm text-slate-500">
                  {c.hours.start}–{c.hours.end} · {c.defaultDuration} min · Rx {c.flags.prescriptions ? "on" : "off"}
                  {!c.hasPassword && (
                    <span className="ml-2 font-semibold text-amber-700">no password set — reset it here</span>
                  )}
                </div>
              </div>
              <a className="btn-secondary" href={bookingPath(c.id)}>
                Booking
              </a>
              <a className="btn-secondary" href={adminBase(c.id)}>
                Admin
              </a>
              {resetFor === c.id ? (
                <form className="flex flex-wrap items-center gap-2" onSubmit={(e) => savePassword(e, c.id)}>
                  <input
                    className="input w-44"
                    type="password"
                    autoComplete="new-password"
                    placeholder="New staff password"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    required
                    minLength={4}
                  />
                  <button className="btn-primary" type="submit" disabled={busy}>
                    Save password
                  </button>
                  <button
                    className="btn-ghost"
                    type="button"
                    onClick={() => {
                      setResetFor(null);
                      setResetPassword("");
                    }}
                  >
                    Cancel
                  </button>
                </form>
              ) : (
                <button
                  className="btn-secondary"
                  type="button"
                  onClick={() => {
                    setResetFor(c.id);
                    setResetPassword("");
                  }}
                >
                  Reset password
                </button>
              )}
              <button className="btn-ghost" onClick={() => toggleEnabled(c.id, !c.enabled)}>
                {c.enabled ? "Disable" : "Enable"}
              </button>
            </div>
          ))}
        </div>

        <form onSubmit={createClinic} className="card mt-8 space-y-3 p-5">
          <h2 className="font-display text-xl text-teal-dark">New clinic</h2>
          <p className="text-sm text-slate-500">
            The admin password is hashed in this app process. Create tenants on the Worker that serves login, not from a
            local script against production Postgres.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Slug (clinic ID)</label>
              <input className="input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="demo2" required />
            </div>
            <div>
              <label className="label">Name</label>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            <div>
              <label className="label">Admin password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <div>
              <label className="label">Default duration (min)</label>
              <input
                className="input"
                type="number"
                min={5}
                value={defaultDuration}
                onChange={(e) => setDefaultDuration(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Opens</label>
              <input className="input" type="time" value={hoursOpen} onChange={(e) => setHoursOpen(e.target.value)} />
            </div>
            <div>
              <label className="label">Closes</label>
              <input className="input" type="time" value={hoursClose} onChange={(e) => setHoursClose(e.target.value)} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {FEATURE_FLAG_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={flags[key]}
                  onChange={(e) => setFlags({ ...flags, [key]: e.target.checked })}
                />
                {key}
              </label>
            ))}
          </div>
          <button className="btn-primary" disabled={busy} type="submit">
            {busy ? "Creating…" : "Create clinic"}
          </button>
        </form>
      </div>
    </div>
  );
}
