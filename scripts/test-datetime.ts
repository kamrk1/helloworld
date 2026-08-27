/**
 * Calendar marker parsing for FullCalendar dateClick/select (Asia/Kolkata).
 *   npx tsx scripts/test-datetime.ts
 */
import {
  fromCalendarMarker,
  istDateTimeFromIsoDate,
  toHHMMIST,
  toISODateIST,
} from "../src/lib/datetime";

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error("FAIL", msg);
    process.exit(1);
  }
}

function check(date: Date, dateStr: string | undefined, isoDate: string, hhmm: string, msg: string) {
  const got = fromCalendarMarker(date, dateStr);
  assert(toISODateIST(got) === isoDate, `${msg}: date ${toISODateIST(got)} !== ${isoDate}`);
  assert(toHHMMIST(got) === hhmm, `${msg}: time ${toHHMMIST(got)} !== ${hhmm}`);
}

const wall = "2026-08-28T15:00:00";
const realInstant = new Date("2026-08-28T09:30:00.000Z"); // 15:00 IST
const markerLike = new Date("2026-08-28T15:00:00.000Z"); // FC stores wall clock in UTC fields

check(realInstant, `${wall}+05:30`, "2026-08-28", "15:00", "dateStr with +05:30 is IST wall clock");
check(realInstant, wall, "2026-08-28", "15:00", "dateStr without offset is IST wall clock");
check(markerLike, `${wall}.000Z`, "2026-08-28", "15:00", "Z suffix still uses the YYYY-MM-DDTHH:mm prefix");
check(realInstant, undefined, "2026-08-28", "15:00", "missing dateStr reads Asia/Kolkata from a real instant");

const eleven = fromCalendarMarker(realInstant, "2026-08-28T11:00:00+05:30");
assert(toISODateIST(eleven) === "2026-08-28" && toHHMMIST(eleven) === "11:00", "11:00 Friday stays Friday 11:00");

const thu = fromCalendarMarker(new Date("2026-08-27T05:30:00.000Z"), "2026-08-27T11:00:00+05:30");
assert(toISODateIST(thu) === "2026-08-27" && toHHMMIST(thu) === "11:00", "Thursday 11:00 stays Thursday 11:00");

assert(
  istDateTimeFromIsoDate("2026-08-28", "15:00").toISOString() === "2026-08-28T09:30:00.000Z",
  "15:00 IST is 09:30 UTC",
);

console.log("ok datetime");
