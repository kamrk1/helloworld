"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiJson } from "@/lib/api-client";

export default function PlatformLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await apiJson("/api/platform/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      router.replace("/platform");
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
        <h1 className="mb-2 text-center font-display text-3xl font-semibold text-teal-dark">Platform</h1>
        <p className="mb-6 text-center text-sm text-slate-500">Operator console</p>
        <form onSubmit={submit} className="card px-6 py-6">
          <label className="label">Platform password</label>
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
            {busy ? "Signing in…" : "Open console"}
          </button>
        </form>
      </div>
    </div>
  );
}
