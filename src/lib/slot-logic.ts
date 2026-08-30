import { DEFAULT_CLINIC } from "./clinic-config";
import { toISODateIST, weekdayIST, istDateTimeFromIsoDate } from "./datetime";
import type { ClinicRuntime } from "./clinic-config";
import {
  generateStartsInWindows,
  hoursFromRuntime,
  hoursWindowsLabel,
  windowContainingStart,
  type ClinicHours,
} from "./clinic-hours";
import { closedDaysLabel } from "./hours-label";

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

export function clinicClosedOn(date: Date, closedWeekdays: number[] = [...DEFAULT_CLINIC.closedWeekdays]) {
  return closedWeekdays.includes(weekdayIST(date));
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart < bEnd && aEnd > bStart;
}

/** True when [start, end) sits entirely inside one open window (cannot span a lunch gap). */
export function rangeFitsHours(start: Date, end: Date, hours: ClinicHours | ClinicRuntime["hours"]) {
  const date = toISODateIST(start);
  const resolved = hoursFromRuntime(hours);
  return resolved.windows.some((w) => {
    const open = istDateTimeFromIsoDate(date, w.start);
    const close = istDateTimeFromIsoDate(date, w.end);
    return start >= open && end <= close;
  });
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

export function generateDayStarts(
  hours: { start: string; end: string; windows?: readonly { start: string; end: string }[] } = DEFAULT_CLINIC.hours,
  slotMinutes: number = DEFAULT_CLINIC.slotMinutes,
) {
  return generateStartsInWindows(hours, slotMinutes);
}

export function hoursLabel(clinic: Pick<ClinicRuntime, "hours" | "closedWeekdays">) {
  const hours = hoursWindowsLabel(clinic.hours);
  const closed = closedDaysLabel(clinic.closedWeekdays);
  return `${hours} · ${closed}`;
}

export function windowEndForStart(
  isoDate: string,
  timeHHMM: string,
  hours: ClinicRuntime["hours"],
  envelopeEnd: string,
) {
  const w = windowContainingStart(timeHHMM, hours);
  return istDateTimeFromIsoDate(isoDate, w?.end ?? envelopeEnd);
}
