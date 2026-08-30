/**
 * Calendar marker parsing for FullCalendar dateClick/select (Asia/Kolkata).
 *   npx tsx scripts/test-datetime.ts
 */
import {
  fromCalendarDateClick,
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

const todayInstant = new Date("2026-08-27T08:00:00+05:30");
check(
  todayInstant,
  "2026-08-29T11:00:00+05:30",
  "2026-08-29",
  "11:00",
  "Saturday dateStr wins over a Date that is Thursday today",
);

const satClick = fromCalendarDateClick({
  date: todayInstant,
  dateStr: "2026-08-27T11:00:00+05:30",
  dayEl: { getAttribute: (name) => (name === "data-date" ? "2026-08-29" : null) },
});
assert(
  toISODateIST(satClick) === "2026-08-29" && toHHMMIST(satClick) === "11:00",
  "dateClick uses the Saturday column data-date, not today in dateStr",
);

const satTarget = fromCalendarDateClick({
  date: todayInstant,
  dateStr: "2026-08-27T15:00:00+05:30",
  dayEl: { getAttribute: () => "2026-08-27" },
  jsEvent: {
    target: {
      closest: (sel: string) =>
        sel === "[data-date]" ? { getAttribute: () => "2026-08-29" } : null,
    } as unknown as EventTarget,
  },
});
assert(
  toISODateIST(satTarget) === "2026-08-29" && toHHMMIST(satTarget) === "15:00",
  "dateClick prefers the clicked cell's data-date over a UTC-shifted today",
);

assert(
  istDateTimeFromIsoDate("2026-08-28", "15:00").toISOString() === "2026-08-28T09:30:00.000Z",
  "15:00 IST is 09:30 UTC",
);

console.log("ok datetime");
