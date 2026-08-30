"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";
import { adminBase } from "@/lib/clinic-config";

export default function ClinicLoginPage({
  clinicId,
  clinicName,
  logoUrl,
}: {
  clinicId: string;
  clinicName: string;
  logoUrl: string;
}) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clinicId, password }),
      });
      router.replace(adminBase(clinicId));
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
          <img src={logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl bg-white object-cover shadow-card" />
          <h1 className="mt-4 font-display text-3xl font-semibold text-teal-dark">{clinicName}</h1>
          <p className="mt-1 text-sm text-gold-dark">Staff sign in · {clinicId}</p>
        </div>
        <form onSubmit={submit} className="card px-6 py-6">
          <label className="label">Password</label>
          <input
            className="input"
            type="password"
            autoFocus
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
          <a className="hover:text-teal" href="/login">
            Sign in with a different clinic ID
          </a>
        </p>
      </div>
    </div>
  );
}
