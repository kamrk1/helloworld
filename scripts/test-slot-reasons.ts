/**
 * Pure slot-reason checks (no database).
 *   npx tsx scripts/test-slot-reasons.ts
 */
import { calendarDateStatus, reasonForSlot } from "../src/lib/slot-logic";
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
