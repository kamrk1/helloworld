"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { LAST_CLINIC_STORAGE_KEY, adminBase } from "@/lib/clinic-config";

export default function GenericLoginPage() {
  const router = useRouter();
  const [clinicId, setClinicId] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    try {
      const last = localStorage.getItem(LAST_CLINIC_STORAGE_KEY);
      if (last) setClinicId(last);
    } catch {
      /* ignore */
    }
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const slug = clinicId.trim().toLowerCase();
    try {
      await apiJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId: slug, password }),
      });
      try {
        localStorage.setItem(LAST_CLINIC_STORAGE_KEY, slug);
      } catch {
        /* ignore */
      }
      router.replace(adminBase(slug));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ivory px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="mx-auto h-16 w-16 rounded-2xl shadow-card" />
          <h1 className="mt-4 font-display text-3xl font-semibold text-teal-dark">Clinic admin</h1>
          <p className="mt-1 text-sm text-gold-dark">Sign in with your clinic ID</p>
        </div>
        <form onSubmit={submit} className="card px-6 py-6">
          <label className="label">Clinic ID</label>
          <input
            className="input mb-4"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={clinicId}
            onChange={(e) => setClinicId(e.target.value)}
            placeholder="e.g. sdc"
            required
          />
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button className="btn-primary mt-5 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Open calendar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          <a className="hover:text-teal" href="/platform/login">
            Platform operator
          </a>
        </p>
      </div>
    </div>
  );
}
