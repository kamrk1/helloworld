"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CLINIC } from "@/lib/clinic-config";
import { apiJson } from "@/lib/api-client";

export default function LoginPage() {
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
        body: JSON.stringify({ password }),
      });
      router.replace("/admin");
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
          <h1 className="mt-4 font-display text-3xl font-semibold text-teal-dark">{CLINIC.name}</h1>
          <p className="mt-1 text-sm text-gold-dark">Staff sign in</p>
        </div>
        <form onSubmit={submit} className="card px-6 py-6">
          <label className="label">Admin password</label>
          <input
            className="input"
            type="password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="ADMIN_PASSWORD"
          />
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <button className="btn-primary mt-5 w-full" disabled={busy}>
            {busy ? "Signing in…" : "Open calendar"}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-400">
          <a className="hover:text-teal" href="/">
            Public booking
          </a>
        </p>
      </div>
    </div>
  );
}
