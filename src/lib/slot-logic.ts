import { CLINIC } from "./clinic-config";
import { toISODateIST, weekdayIST } from "./datetime";

export type SlotReason = "past" | "booked" | "blocked" | "too_late";

export type Slot = { time: string; available: boolean; reason?: SlotReason };

export type DaySlots = {
  date: string;
  closed: boolean;
  past: boolean;
  slots: Slot[];
};

export type TimeRange = { start: Date; end: Date };

export function calendarDateStatus(isoDate: string, now = new Date()): "past" | "today" | "future" {
  const today = toISODateIST(now);
  if (isoDate < today) return "past";
  if (isoDate > today) return "future";
  return "today";
}

export function clinicClosedOn(date: Date) {
  return CLINIC.closedWeekdays.includes(weekdayIST(date));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

export function reasonForSlot(opts: {
  start: Date;
  end: Date;
  now: Date;
  clinicEnd: Date;
  dateStatus: "past" | "today" | "future";
  booked: TimeRange[];
  blocked: TimeRange[];
}): SlotReason | null {
  if (opts.dateStatus === "past" || (opts.dateStatus === "today" && opts.start < opts.now)) {
    return "past";
  }
  if (opts.end > opts.clinicEnd) return "too_late";
  if (opts.blocked.some((r) => overlaps(opts.start, opts.end, r.start, r.end))) return "blocked";
  if (opts.booked.some((r) => overlaps(opts.start, opts.end, r.start, r.end))) return "booked";
  return null;
}

function timeToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function generateDayStarts() {
  const starts: string[] = [];
  const from = timeToMinutes(CLINIC.hours.start);
  const to = timeToMinutes(CLINIC.hours.end);
  for (let t = from; t + CLINIC.slotMinutes <= to; t += CLINIC.slotMinutes) {
    const h = Math.floor(t / 60);
    const m = t % 60;
    starts.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  return starts;
}
