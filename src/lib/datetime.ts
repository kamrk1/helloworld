import { TIMEZONE } from "./clinic-config";

const pad = (n: number) => String(n).padStart(2, "0");

export function getISTParts(date: Date = new Date()) {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hourCycle: "h23",
  });
  const o = Object.fromEntries(dtf.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(o.year),
    month: Number(o.month),
    day: Number(o.day),
    hour: Number(o.hour),
    minute: Number(o.minute),
    weekday: o.weekday as string,
  };
}

/** Construct a Date from a wall-clock time in Asia/Kolkata. */
export function istDateTime(year: number, month: number, day: number, hour = 0, minute = 0) {
  return new Date(
    `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00+05:30`,
  );
}

export function istDateTimeFromIsoDate(isoDate: string, timeHHMM: string) {
  const [hour, minute] = timeHHMM.split(":").map(Number);
  return new Date(`${isoDate}T${pad(hour)}:${pad(minute)}:00+05:30`);
}

export function toISODateIST(date: Date) {
  const p = getISTParts(date);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

export function toHHMMIST(date: Date) {
  const p = getISTParts(date);
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

export function startOfDayIST(date: Date) {
  const p = getISTParts(date);
  return istDateTime(p.year, p.month, p.day, 0, 0);
}

export function endOfDayIST(date: Date) {
  const p = getISTParts(date);
  return istDateTime(p.year, p.month, p.day, 23, 59);
}

export function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86_400_000);
}

export function startOfWeekMondayIST(date: Date = new Date()) {
  const p = getISTParts(date);
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dow = weekdays.indexOf(p.weekday);
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDays(istDateTime(p.year, p.month, p.day, 0, 0), mondayOffset);
}

export function weekdayIST(date: Date) {
  const p = getISTParts(date);
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
}

export function formatIST(date: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("en-IN", { timeZone: TIMEZONE, ...options }).format(date);
}

export function formatDateLong(date: Date) {
  return formatIST(date, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

export function formatTime(date: Date) {
  return formatIST(date, { hour: "numeric", minute: "2-digit", hour12: true });
}

export function formatDateTime(date: Date) {
  return `${formatDateLong(date)}, ${formatTime(date)}`;
}

export function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60_000);
}

export function durationMinutes(start: Date, end: Date) {
  return Math.round((end.getTime() - start.getTime()) / 60_000);
}

/** Sheet date like 27-Aug-2026 */
export function parseSheetDate(value: string): { y: number; m: number; d: number } | null {
  const raw = value.trim();
  if (!raw) return null;
  const months: Record<string, number> = {
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
    jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
  };
  const m1 = raw.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m1) {
    const month = months[m1[2].toLowerCase()];
    if (!month) return null;
    return { y: Number(m1[3]), m: month, d: Number(m1[1]) };
  }
  const m2 = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m2) return { y: Number(m2[1]), m: Number(m2[2]), d: Number(m2[3]) };
  return null;
}

/** Sheet time like 10:30 AM / 1:00 pm / 10:30 */
export function parseSheetTime(value: string): { h: number; min: number } | null {
  const raw = value.trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)?$/);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = m[3]?.toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, min };
}

export function sheetDateTime(dateStr: string, timeStr: string | undefined, endOfDay = false) {
  const d = parseSheetDate(dateStr);
  if (!d) return null;
  if (!timeStr) {
    return endOfDay ? istDateTime(d.y, d.m, d.d, 23, 59) : istDateTime(d.y, d.m, d.d, 0, 0);
  }
  const t = parseSheetTime(timeStr);
  if (!t) return null;
  return istDateTime(d.y, d.m, d.d, t.h, t.min);
}
