"use client";

import { useEffect, useMemo, useState } from "react";
import { CLINIC } from "@/lib/clinic-config";
import { addDays, toISODateIST, weekdayIST } from "@/lib/datetime";
import { displayPhone } from "@/lib/phone";

type Slot = { time: string; available: boolean };

function nextOpenDate() {
  let d = new Date();
  for (let i = 0; i < 14; i++) {
    if (!CLINIC.closedWeekdays.includes(weekdayIST(d))) {
      const iso = toISODateIST(d);
      // if today is Sunday-closed, skip; if all remaining slots may be past, still OK
      return iso;
    }
    d = addDays(d, 1);
  }
  return toISODateIST(new Date());
}

function prettyTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

export default function BookingPage() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<string>(CLINIC.services[0]);
  const [date, setDate] = useState(nextOpenDate);
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ ref: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setTime("");
    fetch(`/api/slots?date=${date}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        setSlots(json.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  const openSlots = useMemo(() => slots.filter((s) => s.available), [slots]);
  const clinicPhone = process.env.NEXT_PUBLIC_CLINIC_PHONE || "";

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!time) {
      setError("Pick a time slot");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, phone, email, service, date, time, notes }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not book");
      setDone({ ref: json.appointment.ref });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-ivory">
      <header className="border-b border-teal/10 bg-teal text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.svg" alt="" className="h-12 w-12 rounded-xl ring-2 ring-gold/70" />
          <div>
            <h1 className="font-display text-2xl font-semibold">{CLINIC.name}</h1>
            <p className="text-sm text-white/80">{CLINIC.tagline} · {CLINIC.hours.start}–{CLINIC.hours.end} · Sun closed</p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Book a visit</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-teal-dark">Choose a slot that works for you</h2>
          <p className="mt-3 max-w-lg text-slate-600">
            Requests land as pending. The clinic will confirm on WhatsApp. Asia/Kolkata, 30-minute slots.
          </p>
          {clinicPhone && (
            <p className="mt-4 text-sm text-slate-500">Call {displayPhone(clinicPhone)}</p>
          )}
          {done ? (
            <div className="card mt-8 p-6">
              <div className="text-sm font-semibold uppercase tracking-wide text-gold-dark">Request received</div>
              <p className="mt-2 font-display text-2xl text-teal-dark">Thank you, {name.split(" ")[0]}.</p>
              <p className="mt-2 text-slate-600">
                Your booking reference is <span className="font-semibold">{done.ref}</span>. We’ll confirm shortly.
              </p>
              <button className="btn-secondary mt-6" onClick={() => setDone(null)}>
                Book another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="card mt-8 space-y-4 p-6">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="label">Full name</label>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
                </div>
                <div>
                  <label className="label">Mobile</label>
                  <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} required inputMode="tel" />
                </div>
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="optional" />
              </div>
              <div>
                <label className="label">Service / concern</label>
                <select className="input" value={service} onChange={(e) => setService(e.target.value)}>
                  {CLINIC.services.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Date</label>
                <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div>
                <label className="label">Available times</label>
                {loadingSlots && <p className="text-sm text-slate-400">Loading slots…</p>}
                {!loadingSlots && openSlots.length === 0 && (
                  <p className="text-sm text-slate-500">No open slots this day. Try another date.</p>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  {slots.map((s) => (
                    <button
                      type="button"
                      key={s.time}
                      disabled={!s.available}
                      onClick={() => setTime(s.time)}
                      className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${
                        time === s.time
                          ? "border-teal bg-teal text-white"
                          : s.available
                            ? "border-slate-200 bg-white hover:border-teal"
                            : "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through"
                      }`}
                    >
                      {prettyTime(s.time)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy}>
                {busy ? "Sending…" : "Request appointment"}
              </button>
            </form>
          )}
        </section>
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-teal p-6 text-white shadow-card">
            <div className="font-display text-2xl">Clinic hours</div>
            <p className="mt-3 text-white/85">Monday–Saturday · {CLINIC.hours.start} – {CLINIC.hours.end}</p>
            <p className="text-white/85">Sunday closed</p>
            <p className="mt-4 text-sm text-gold-light">Timezone {CLINIC.timezone}</p>
          </div>
          <div className="card p-6">
            <div className="font-display text-xl text-teal-dark">What to expect</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Online requests stay pending until the doctor approves.</li>
              <li>Bring any previous x-rays or prescriptions.</li>
              <li>Please arrive 10 minutes early for first visits.</li>
            </ul>
          </div>
        </aside>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <a href="/login" className="hover:text-teal">
          Staff login
        </a>
      </footer>
    </div>
  );
}
