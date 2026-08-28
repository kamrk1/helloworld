import { ACTIVE_STATUSES, type ClinicRuntime } from "./clinic-config";
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

export async function occupiedRanges(
  clinicId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
) {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeAppointmentId ? { id: { not: excludeAppointmentId } } : {}),
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.clinicBlock.findMany({
      where: { clinicId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  return [
    ...appointments.map((a) => ({ start: a.startAt, end: a.endAt })),
    ...blocks.map((b) => ({ start: b.startAt, end: b.endAt })),
  ];
}

export async function listSlotsForDate(
  clinic: ClinicRuntime,
  isoDate: string,
  durationMin: number = clinic.defaultDuration,
): Promise<DaySlots> {
  const dayStart = istDateTimeFromIsoDate(isoDate, "00:00");
  const dateStatus = calendarDateStatus(isoDate);
  const past = dateStatus === "past";
  if (clinicClosedOn(dayStart, clinic.closedWeekdays)) {
    return { date: isoDate, closed: true, past, slots: [] };
  }

  const dayEnd = istDateTimeFromIsoDate(isoDate, "23:59");
  const windowEnd = addMinutes(dayEnd, 1);
  const [appointmentRows, blockRows] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: clinic.id,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: windowEnd },
        endAt: { gt: dayStart },
      },
      select: { startAt: true, endAt: true },
    }),
    prisma.clinicBlock.findMany({
      where: { clinicId: clinic.id, startAt: { lt: windowEnd }, endAt: { gt: dayStart } },
      select: { startAt: true, endAt: true },
    }),
  ]);
  const booked = appointmentRows.map((a) => ({ start: a.startAt, end: a.endAt }));
  const blocked = blockRows.map((b) => ({ start: b.startAt, end: b.endAt }));
  const now = new Date();
  const clinicEnd = istDateTimeFromIsoDate(isoDate, clinic.hours.end);

  const slots = generateDayStarts(clinic.hours, clinic.slotMinutes).map((time) => {
    const start = istDateTimeFromIsoDate(isoDate, time);
    const end = addMinutes(start, durationMin);
    const reason = reasonForSlot({ start, end, now, clinicEnd, dateStatus, booked, blocked });
    return reason ? { time, available: false, reason } : { time, available: true };
  });
  return { date: isoDate, closed: false, past, slots };
}

export async function findConflicts(opts: {
  clinicId: string;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
  excludeBlockId?: string;
}) {
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        clinicId: opts.clinicId,
        status: { in: [...ACTIVE_STATUSES] },
        startAt: { lt: opts.endAt },
        endAt: { gt: opts.startAt },
        ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
      },
      select: { id: true, ref: true, startAt: true, endAt: true, status: true },
    }),
    prisma.clinicBlock.findMany({
      where: {
        clinicId: opts.clinicId,
        startAt: { lt: opts.endAt },
        endAt: { gt: opts.startAt },
        ...(opts.excludeBlockId ? { id: { not: opts.excludeBlockId } } : {}),
      },
    }),
  ]);
  return { appointments, blocks };
}

export async function assertBookable(opts: {
  clinic: ClinicRuntime;
  startAt: Date;
  endAt: Date;
  excludeAppointmentId?: string;
  allowOutsideHours?: boolean;
}) {
  if (opts.endAt <= opts.startAt) {
    return "End time must be after start time";
  }
  if (!opts.allowOutsideHours) {
    if (clinicClosedOn(opts.startAt, opts.clinic.closedWeekdays)) {
      return "Clinic is closed that day";
    }
    const date = toISODateIST(opts.startAt);
    const open = istDateTimeFromIsoDate(date, opts.clinic.hours.start);
    const close = istDateTimeFromIsoDate(date, opts.clinic.hours.end);
    if (opts.startAt < open || opts.endAt > close) {
      return `Clinic hours are ${opts.clinic.hours.start}–${opts.clinic.hours.end}`;
    }
  }
  const conflicts = await findConflicts({
    clinicId: opts.clinic.id,
    startAt: opts.startAt,
    endAt: opts.endAt,
    excludeAppointmentId: opts.excludeAppointmentId,
  });
  if (conflicts.blocks.length) return "That time is blocked (clinic closure)";
  if (conflicts.appointments.length) {
    return `Slot overlaps appointment ${conflicts.appointments[0].ref}`;
  }
  return null;
}
