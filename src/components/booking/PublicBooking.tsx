"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, istDateTimeFromIsoDate, toISODateIST, weekdayIST } from "@/lib/datetime";
import { displayPhone, isValidPhone, normalizePhone } from "@/lib/phone";
import { apiJson } from "@/lib/api-client";
import type { Slot, SlotReason } from "@/lib/slot-logic";
import type { PublicClinicDTO } from "@/lib/clinic-runtime";
import { closedDaysLabel, openDaysLabel } from "@/lib/hours-label";
import { clinicLoginPath } from "@/lib/clinic-config";

function nextOpenDate(clinic: PublicClinicDTO) {
  const now = new Date();
  let d = now;
  for (let i = 0; i < 14; i++) {
    if (!clinic.closedWeekdays.includes(weekdayIST(d))) {
      const iso = toISODateIST(d);
      const close = istDateTimeFromIsoDate(iso, clinic.hours.end);
      if (now < close) return iso;
    }
    d = addDays(d, 1);
  }
  return toISODateIST(addDays(now, 1));
}

function prettyTime(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit", hour12: true }).format(d);
}

const REASON_TITLE: Record<SlotReason, string> = {
  past: "This time has passed",
  booked: "Already booked",
  blocked: "Clinic closed this hour",
  too_late: "Not enough time before closing",
};

function slotButtonClass(s: Slot, selected: boolean) {
  if (selected) return "border-teal bg-teal text-white";
  if (s.available) return "border-slate-200 bg-white hover:border-teal";
  if (s.reason === "blocked") return "cursor-not-allowed border-red-100 bg-red-50 text-red-400";
  if (s.reason === "booked") {
    return "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-300 line-through";
  }
  return "cursor-not-allowed border-slate-100 bg-slate-50 text-slate-400";
}

export function PublicBooking({ clinic }: { clinic: PublicClinicDTO }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [service, setService] = useState<string>(clinic.services[0] ?? "Consultation");
  const [date, setDate] = useState(() => nextOpenDate(clinic));
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [dayClosed, setDayClosed] = useState(false);
  const [dayPast, setDayPast] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ ref: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setTime("");
    fetch(`/api/c/${encodeURIComponent(clinic.id)}/slots?date=${date}`)
      .then(async (res) => {
        const json = await res.json();
        if (!res.ok) {
          throw new Error(typeof json.error === "string" ? json.error : "Could not load slots");
        }
        return json as { date?: string; slots?: Slot[]; closed?: boolean; past?: boolean };
      })
      .then((json) => {
        if (cancelled) return;
        if (json.date && json.date !== date) return;
        setSlots(json.slots ?? []);
        setDayClosed(Boolean(json.closed));
        setDayPast(Boolean(json.past));
      })
      .catch(() => {
        if (!cancelled) {
          setSlots([]);
          setDayClosed(false);
          setDayPast(false);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clinic.id, date]);

  const openSlots = useMemo(() => slots.filter((s) => s.available), [slots]);
  const closedLabel = closedDaysLabel(clinic.closedWeekdays);
  const allRemainingPast =
    !dayPast && slots.length > 0 && openSlots.length === 0 && slots.every((s) => s.reason === "past" || s.reason === "too_late");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (dayPast) {
      setError("That date has passed. Choose today or a later weekday.");
      return;
    }
    if (!time) {
      setError("Pick a time slot");
      return;
    }
    if (!name.trim()) {
      setError("Patient name is required");
      return;
    }
    if (!isValidPhone(phone)) {
      setError("Enter a 10-digit mobile number");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const json = await apiJson<{ appointment: { ref: string } }>(
        `/api/c/${encodeURIComponent(clinic.id)}/book`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            phone: normalizePhone(phone),
            email,
            service,
            date,
            time,
            notes,
          }),
        },
      );
      setDone({ ref: json.appointment.ref });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not book");
    } finally {
      setBusy(false);
    }
  }

  const brandStyle = {
    ["--brand-primary" as string]: clinic.brand.primary,
    ["--brand-accent" as string]: clinic.brand.accent,
  };

  return (
    <div className="min-h-dvh bg-ivory" style={brandStyle}>
      <header className="border-b border-teal/10 bg-teal text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={clinic.logoUrl} alt="" className="h-12 w-12 rounded-xl bg-white object-cover ring-2 ring-gold/70" />
          <div>
            <h1 className="font-display text-2xl font-semibold">{clinic.name}</h1>
            <p className="text-sm text-white/80">
              {clinic.tagline} · {clinic.hours.start}–{clinic.hours.end} · {closedLabel}
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-8 px-4 py-10 lg:grid-cols-[1.1fr_0.9fr]">
        <section>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold-dark">Book a visit</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-teal-dark">Choose a slot that works for you</h2>
          <p className="mt-3 max-w-lg text-slate-600">
            {clinic.flags.publicBooking
              ? "Requests land as pending until the clinic confirms."
              : "Online booking is paused."}{" "}
            {clinic.timezone}, {clinic.defaultDuration}-minute default visits.
          </p>
          {clinic.phone && <p className="mt-4 text-sm text-slate-500">Call {displayPhone(clinic.phone)}</p>}
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
                  {clinic.services.map((s) => (
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
                {!loadingSlots && dayPast && (
                  <p className="text-sm text-slate-600">This date has passed. Choose today or a later weekday.</p>
                )}
                {!loadingSlots && !dayPast && dayClosed && (
                  <p className="text-sm text-slate-600">{closedLabel}.</p>
                )}
                {!loadingSlots && !dayPast && !dayClosed && allRemainingPast && (
                  <p className="text-sm text-slate-600">Today’s remaining times have passed. Try another date.</p>
                )}
                {!loadingSlots && !dayPast && !dayClosed && !allRemainingPast && openSlots.length === 0 && slots.length > 0 && (
                  <p className="text-sm text-slate-600">No open slots this day. Try another date.</p>
                )}
                {!loadingSlots && !dayPast && !dayClosed && slots.length > 0 && (
                  <>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {slots.map((s) => (
                        <button
                          type="button"
                          key={s.time}
                          disabled={!s.available}
                          title={s.reason ? REASON_TITLE[s.reason] : undefined}
                          onClick={() => setTime(s.time)}
                          className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${slotButtonClass(s, time === s.time)}`}
                        >
                          {prettyTime(s.time)}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-medium text-slate-500">
                      <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5">Open</span>
                      <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-slate-400">Passed</span>
                      <span className="rounded-md border border-slate-100 bg-slate-50 px-2 py-0.5 text-slate-300 line-through">
                        Booked
                      </span>
                      <span className="rounded-md border border-red-100 bg-red-50 px-2 py-0.5 text-red-400">Closed</span>
                    </div>
                  </>
                )}
              </div>
              <div>
                <label className="label">Notes</label>
                <textarea className="input min-h-[72px]" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button className="btn-primary w-full py-3" disabled={busy || dayPast || dayClosed}>
                {busy ? "Sending…" : "Request appointment"}
              </button>
            </form>
          )}
        </section>
        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl bg-teal p-6 text-white shadow-card">
            <div className="font-display text-2xl">Clinic hours</div>
            <p className="mt-3 text-white/85">
              {openDaysLabel(clinic.closedWeekdays)} · {clinic.hours.start} – {clinic.hours.end}
            </p>
            <p className="text-white/85">{closedLabel}</p>
            {clinic.address && <p className="mt-3 text-sm text-white/80">{clinic.address}</p>}
            <p className="mt-4 text-sm text-gold-light">Timezone {clinic.timezone}</p>
          </div>
          <div className="card p-6">
            <div className="font-display text-xl text-teal-dark">What to expect</div>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-600">
              <li>Online requests stay pending until the clinic approves.</li>
              <li>Bring any previous x-rays or prescriptions.</li>
              <li>Please arrive 10 minutes early for first visits.</li>
            </ul>
          </div>
        </aside>
      </main>
      <footer className="border-t border-slate-200 py-6 text-center text-xs text-slate-400">
        <a href={clinicLoginPath(clinic.id)} className="hover:text-teal">
          Staff login
        </a>
      </footer>
    </div>
  );
}
