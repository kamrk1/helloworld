import { CLINIC, ACTIVE_STATUSES } from "./clinic-config";
import { addMinutes, istDateTimeFromIsoDate, toISODateIST } from "./datetime";
import { prisma } from "./prisma";
import {
  calendarDateStatus,
  clinicClosedOn,
  generateDayStarts,
  reasonForSlot,
  type DaySlots,
} from "./slot-logic";

export {
  calendarDateStatus,
  clinicClosedOn,
  generateDayStarts,
  reasonForSlot,
  type DaySlots,
  type Slot,
  type SlotReason,
} from "./slot-logic";

export async function occupiedRanges(from: Date, to: Date, excludeAppointmentId?: string) {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.clinicBlock.findMany({
      where: { startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  return [
    ...appointments.map((a) => ({ start: a.startAt, end: a.endAt })),
    ...blocks.map((b) => ({ start: b.startAt, end: b.endAt })),
  ];
}

export async function listSlotsForDate(
  isoDate: string,
  durationMin: number = CLINIC.defaultDuration,
): Promise<DaySlots> {
  const dayStart = istDateTimeFromIsoDate(isoDate, "00:00");
  const dateStatus = calendarDateStatus(isoDate);
  const past = dateStatus === "past";
  if (clinicClosedOn(dayStart)) {
    return { date: isoDate, closed: true, past, slots: [] };
  }

  const dayEnd = istDateTimeFromIsoDate(isoDate, "23:59");
  const windowEnd = addMinutes(dayEnd, 1);
  const [appointmentRows, blockRows] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: windowEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.clinicBlock.findMany({
      where: { startAt: { lt: windowEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const booked = appointmentRows.map((a) => ({ start: a.startAt, end: a.endAt }));
  const blocked = blockRows.map((b) => ({ start: b.startAt, end: b.endAt }));
  const now = new Date();
  const clinicEnd = istDateTimeFromIsoDate(isoDate, CLINIC.hours.end);

  const slots = generateDayStarts().map((time) => {
    const start = istDateTimeFromIsoDate(isoDate, time);
    const end = addMinutes(start, durationMin);
    const reason = reasonForSlot({ start, end, now, clinicEnd, dateStatus, booked, blocked });
    return reason ? { time, available: false, reason } : { time, available: true };
  });
  return { date: isoDate, closed: false, past, slots };
}

export async function findConflicts(opts: {
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
  excludeBlockId?: string;
}) {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: opts.endAt },
        endAt: { gt: opts.startAt },
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { id: true, ref: true, startAt: true, endAt: true, status: true },
    }),
    prisma.clinicBlock.findMany({
      where: {
        startAt: { lt: opts.endAt },
        endAt: { gt: opts.startAt },
        ...(opts.excludeBlockId ? { id: { not: opts.excludeBlockId } } : {}),
      },
    }),
  ]);
  return { appointments, blocks };
}

export async function assertBookable(opts: {
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
  allowOutsideHours?: boolean;
}) {
  if (opts.endAt <= opts.startAt) {
    return "End time must be after start time";
  }
  if (!opts.allowOutsideHours) {
    if (clinicClosedOn(opts.startAt)) return "Clinic is closed on Sundays";
    const date = toISODateIST(opts.startAt);
    const open = istDateTimeFromIsoDate(date, CLINIC.hours.start);
    const close = istDateTimeFromIsoDate(date, CLINIC.hours.end);
    if (opts.startAt < open || opts.endAt > close) {
      return `Clinic hours are ${CLINIC.hours.start}–${CLINIC.hours.end}`;
    }
  }
  const conflicts = await findConflicts(opts);
  if (conflicts.blocks.length) return "That time is blocked (clinic closure)";
  if (conflicts.appointments.length) {
    return `Slot overlaps appointment ${conflicts.appointments[0].ref}`;
  }
  return null;
}
