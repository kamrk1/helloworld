/**
 * Pure slot-reason checks (no database).
 *   npx tsx scripts/test-slot-reasons.ts
 */
import { calendarDateStatus, generateDayStarts, hoursLabel, rangeFitsHours, reasonForSlot } from "../src/lib/slot-logic";
import { addMinutes, istDateTimeFromIsoDate } from "../src/lib/datetime";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

const now = new Date("2026-08-27T08:30:00+05:30"); // 8:30am IST 27 Aug
assert(calendarDateStatus("2026-08-26", now) === "past", "26 Aug is past");
assert(calendarDateStatus("2026-08-27", now) === "today", "27 Aug is today");
assert(calendarDateStatus("2026-08-28", now) === "future", "28 Aug is future");

const block = {
  start: istDateTimeFromIsoDate("2026-08-26", "16:00"),
  end: istDateTimeFromIsoDate("2026-08-26", "17:00"),
};
const booked = {
  start: istDateTimeFromIsoDate("2026-08-26", "18:00"),
  end: istDateTimeFromIsoDate("2026-08-26", "18:30"),
};

function check(isoDate: string, time: string, dateStatus: "past" | "today" | "future") {
  const start = istDateTimeFromIsoDate(isoDate, time);
  const end = addMinutes(start, 30);
  return reasonForSlot({
    start,
    end,
    now,
    clinicEnd: istDateTimeFromIsoDate(isoDate, "20:00"),
    dateStatus,
    booked: [booked],
    blocked: [block],
  });
}

assert(check("2026-08-26", "10:00", "past") === "past", "past date 10am is past, not blocked");
assert(check("2026-08-26", "16:00", "past") === "past", "past date 4pm is past, not closed-day");
assert(check("2026-08-26", "17:00", "future") === null, "4–5pm block does not close 5pm");
assert(check("2026-08-26", "16:00", "future") === "blocked", "4pm is blocked");
assert(check("2026-08-26", "16:30", "future") === "blocked", "4:30pm is blocked");
assert(check("2026-08-26", "10:00", "future") === null, "future 10am stays open beside a 4pm block");
assert(check("2026-08-26", "18:00", "future") === "booked", "6pm is booked");
assert(check("2026-08-26", "19:00", "future") === null, "7pm stays open");

const splitHours = {
  start: "10:00",
  end: "21:00",
  windows: [
    { start: "10:00", end: "14:00" },
    { start: "16:00", end: "21:00" },
  ],
};
const splitStarts = generateDayStarts(splitHours, 30);
assert(splitStarts[0] === "10:00", "split starts at 10:00");
assert(splitStarts.includes("13:30"), "morning last 30m start is 13:30");
assert(!splitStarts.includes("14:00"), "gap 14:00 is not a start");
assert(!splitStarts.includes("15:30"), "gap 15:30 is not a start");
assert(splitStarts.includes("16:00"), "afternoon resumes at 16:00");
assert(splitStarts.includes("20:30"), "20:30 is last afternoon start");

const gapStart = istDateTimeFromIsoDate("2026-08-26", "14:00");
const gapEnd = addMinutes(gapStart, 30);
assert(!rangeFitsHours(gapStart, gapEnd, splitHours), "14:00–14:30 is the lunch gap");
const spanStart = istDateTimeFromIsoDate("2026-08-26", "13:30");
const spanEnd = addMinutes(spanStart, 90);
assert(!rangeFitsHours(spanStart, spanEnd, splitHours), "90m cannot span 14:00–16:00");
const morningOk = istDateTimeFromIsoDate("2026-08-26", "13:00");
assert(rangeFitsHours(morningOk, addMinutes(morningOk, 60), splitHours), "13:00–14:00 fits morning window");
assert(
  hoursLabel({ hours: splitHours, closedWeekdays: [0] }) === "10:00–14:00, 16:00–21:00 · Sunday closed",
  "hoursLabel lists both windows",
);

const todayMorning = new Date("2026-08-27T11:00:00+05:30");
const todayClose = istDateTimeFromIsoDate("2026-08-27", "20:00");
const today10 = istDateTimeFromIsoDate("2026-08-27", "10:00");
assert(
  reasonForSlot({
    start: today10,
    end: addMinutes(today10, 30),
    now: todayMorning,
    clinicEnd: todayClose,
    dateStatus: "today",
    booked: [],
    blocked: [],
  }) === "past",
  "today 10am is past at 11am",
);
const today15 = istDateTimeFromIsoDate("2026-08-27", "15:00");
assert(
  reasonForSlot({
    start: today15,
    end: addMinutes(today15, 30),
    now: todayMorning,
    clinicEnd: todayClose,
    dateStatus: "today",
    booked: [],
    blocked: [],
  }) === null,
  "today 3pm stays bookable at 11am",
);

console.log("slot reason checks passed");
