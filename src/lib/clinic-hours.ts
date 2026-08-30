/** Ordered non-overlapping clinic open windows (HH:MM). Envelope is min start / max end. */

export type HoursWindow = { start: string; end: string };

export type ClinicHours = {
  start: string;
  end: string;
  windows: HoursWindow[];
};

export function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHHMM(total: number) {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function normalizeHHMM(raw: string): string | null {
  const m = raw.trim().match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

export function envelopeHours(windows: HoursWindow[]): { start: string; end: string } {
  const sorted = [...windows].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  return { start: sorted[0].start, end: sorted[sorted.length - 1].end };
}

export function validateHoursWindows(
  input: readonly HoursWindow[],
): { ok: true; windows: HoursWindow[] } | { ok: false; error: string } {
  if (!input.length) return { ok: false, error: "Add at least one open window" };
  if (input.length > 8) return { ok: false, error: "Too many hour windows" };
  const windows: HoursWindow[] = [];
  for (const w of input) {
    const start = normalizeHHMM(w.start);
    const end = normalizeHHMM(w.end);
    if (!start || !end) return { ok: false, error: "Use hours like 10:00" };
    if (timeToMinutes(start) >= timeToMinutes(end)) {
      return { ok: false, error: "Each window must start before it ends" };
    }
    windows.push({ start, end });
  }
  windows.sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
  for (let i = 1; i < windows.length; i++) {
    if (timeToMinutes(windows[i].start) < timeToMinutes(windows[i - 1].end)) {
      return { ok: false, error: "Hour windows cannot overlap" };
    }
  }
  return { ok: true, windows };
}

function fallbackWindow(hoursOpen: string, hoursClose: string): HoursWindow {
  const start = normalizeHHMM(hoursOpen) || "10:00";
  let end = normalizeHHMM(hoursClose) || "20:00";
  if (timeToMinutes(start) >= timeToMinutes(end)) end = "20:00";
  if (timeToMinutes(start) >= timeToMinutes(end)) return { start: "10:00", end: "20:00" };
  return { start, end };
}

/** `[]` / missing / invalid hoursJson → one window from hoursOpen / hoursClose. */
export function parseHoursJson(raw: string | null | undefined, fallback: HoursWindow): HoursWindow[] {
  if (!raw || raw.trim() === "" || raw.trim() === "[]") return [fallback];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v) || v.length === 0) return [fallback];
    const windows: HoursWindow[] = [];
    for (const item of v) {
      if (!item || typeof item !== "object") return [fallback];
      const rec = item as Record<string, unknown>;
      const start = normalizeHHMM(String(rec.start ?? ""));
      const end = normalizeHHMM(String(rec.end ?? ""));
      if (!start || !end) return [fallback];
      windows.push({ start, end });
    }
    const checked = validateHoursWindows(windows);
    return checked.ok ? checked.windows : [fallback];
  } catch {
    return [fallback];
  }
}

export function resolveClinicHours(hoursOpen: string, hoursClose: string, hoursJson?: string | null): ClinicHours {
  const fallback = fallbackWindow(hoursOpen, hoursClose);
  const windows = parseHoursJson(hoursJson, fallback);
  const env = envelopeHours(windows);
  return { start: env.start, end: env.end, windows };
}

export function hoursFromRuntime(hours: { start: string; end: string; windows?: readonly HoursWindow[] }): ClinicHours {
  if (hours.windows && hours.windows.length) {
    const checked = validateHoursWindows(hours.windows);
    const windows = checked.ok ? checked.windows : [fallbackWindow(hours.start, hours.end)];
    const env = envelopeHours(windows);
    return { start: env.start, end: env.end, windows };
  }
  return resolveClinicHours(hours.start, hours.end, "[]");
}

export function hoursWindowsLabel(hours: { start: string; end: string; windows?: readonly HoursWindow[] }) {
  const resolved = hoursFromRuntime(hours);
  return resolved.windows.map((w) => `${w.start}–${w.end}`).join(", ");
}

export function generateStartsInWindows(
  hours: { start: string; end: string; windows?: readonly HoursWindow[] },
  slotMinutes: number,
) {
  const resolved = hoursFromRuntime(hours);
  const step = slotMinutes > 0 ? slotMinutes : 30;
  const starts: string[] = [];
  for (const w of resolved.windows) {
    const from = timeToMinutes(w.start);
    const to = timeToMinutes(w.end);
    for (let t = from; t + step <= to; t += step) {
      starts.push(minutesToHHMM(t));
    }
  }
  return starts;
}

export function windowContainingStart(
  hhmm: string,
  hours: { start: string; end: string; windows?: readonly HoursWindow[] },
): HoursWindow | null {
  const t = timeToMinutes(hhmm);
  if (!Number.isFinite(t)) return null;
  const resolved = hoursFromRuntime(hours);
  return resolved.windows.find((w) => t >= timeToMinutes(w.start) && t < timeToMinutes(w.end)) ?? null;
}
