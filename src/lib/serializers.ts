import { Prisma, type Appointment, type Patient, type ClinicBlock, type Prescription } from "@prisma/client";
import type { AppointmentStatus, ClinicRuntime } from "./clinic-config";
import type { AppointmentDTO, BlockDTO, PatientDTO, PrescriptionDTO, InvoiceDTO } from "./types";
import { prisma } from "./prisma";
import { getISTParts } from "./datetime";
import { toAdminClinic } from "./clinic-runtime";

type ApptWithPatient = Appointment & {
  patient: Patient;
  prescription?: { id: string } | null;
  invoice?: { id: string } | null;
};

export function toAppointmentDTO(row: ApptWithPatient): AppointmentDTO {
  return {
    id: row.id,
    ref: row.ref,
    patientId: row.patientId,
    patientName: row.patient.name,
    phone: row.patient.phone,
    email: row.patient.email,
    service: row.service,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    durationMin: row.durationMin,
    notes: row.notes,
    status: row.status as AppointmentStatus,
    googleCalEventId: row.googleCalEventId,
    rxLink: row.rxLink,
    followupDate: row.followupDate ? row.followupDate.toISOString() : null,
    hasPrescription: Boolean(row.prescription ?? row.rxLink),
    hasInvoice: Boolean(row.invoice),
  };
}

export function toPatientDTO(row: Patient): PatientDTO {
  return {
    id: row.id,
    phone: row.phone,
    name: row.name,
    email: row.email,
    firstVisit: row.firstVisit ? row.firstVisit.toISOString() : null,
    lastVisit: row.lastVisit ? row.lastVisit.toISOString() : null,
    totalBookings: row.totalBookings,
    concerns: row.concerns,
  };
}

export function toBlockDTO(row: ClinicBlock): BlockDTO {
  return {
    id: row.id,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt.toISOString(),
    allDay: row.allDay,
    reason: row.reason,
  };
}

export function toPrescriptionDTO(row: Prescription): PrescriptionDTO {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    complaints: row.complaints,
    findings: row.findings,
    diagnosis: row.diagnosis,
    medicines: row.medicines,
    advice: row.advice,
    followupNote: row.followupNote,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function toInvoiceDTO(row: any): InvoiceDTO {
  return {
    id: row.id,
    appointmentId: row.appointmentId,
    billNo: row.billNo,
    date: row.date.toISOString(),
    amountWords: row.amountWords,
    paymentMode: row.paymentMode,
    items: JSON.parse(row.itemsJson || "[]"),
    totalAmount: row.totalAmount,
  };
}

export function makeRef(clinicId: string, date: Date) {
  const p = getISTParts(date);
  const ymd = `${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  const prefix = clinicId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "CLN";
  return `${prefix}-${ymd}-${rand}`;
}

/** Random clinic-day ref. Insert and retry on unique conflict — no SELECT first. */
export function uniqueRef(clinicId: string, date: Date) {
  return makeRef(clinicId, date);
}

function isUniqueRefConflict(err: unknown) {
  if (!(err instanceof Prisma.PrismaClientKnownRequestError) || err.code !== "P2002") {
    return false;
  }
  const target = err.meta?.target;
  if (Array.isArray(target)) return target.includes("ref");
  if (typeof target === "string") return target.includes("ref");
  return true;
}

export const appointmentInclude = {
  patient: true,
  prescription: { select: { id: true } },
  invoice: { select: { id: true } },
} as const;

type AppointmentCreateFields = {
  clinicId: string;
  patientId: string;
  service: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  notes?: string | null;
  status?: string;
};

/** INSERT only — no include (that wraps BEGIN/SELECT patient+rx/COMMIT ≈ 4 RTTs). */
export async function insertAppointment(data: AppointmentCreateFields) {
  let lastErr: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      return await prisma.appointment.create({
        data: { ...data, ref: uniqueRef(data.clinicId, data.startAt) },
      });
    } catch (err) {
      lastErr = err;
      if (!isUniqueRefConflict(err)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Could not allocate appointment ref");
}

export function toAppointmentDTOFromPatient(row: Appointment, patient: Patient): AppointmentDTO {
  return toAppointmentDTO({ ...row, patient, prescription: null, invoice: null });
}

const ACTIVE_STATUSES = ["PENDING", "APPROVED", "CONFIRMED"] as const;

/** One UPDATE for a new booking — no history scan. */
export async function recordPatientBooking(patientId: string, startAt: Date) {
  await prisma.$executeRaw`
    UPDATE "Patient"
    SET
      "totalBookings" = "totalBookings" + 1,
      "firstVisit" = COALESCE("firstVisit", ${startAt}),
      "lastVisit" = CASE
        WHEN "lastVisit" IS NULL OR "lastVisit" < ${startAt} THEN ${startAt}
        ELSE "lastVisit"
      END,
      "updatedAt" = ${new Date()}
    WHERE "id" = ${patientId}
  `;
}

export async function refreshPatientStats(patientId: string) {
  const [agg, services] = await Promise.all([
    prisma.appointment.aggregate({
      where: { patientId, status: { in: [...ACTIVE_STATUSES] } },
      _count: { _all: true },
      _min: { startAt: true },
      _max: { startAt: true },
    }),
    prisma.appointment.findMany({
      where: { patientId, status: { in: [...ACTIVE_STATUSES] } },
      distinct: ["service"],
      select: { service: true },
    }),
  ]);
  return prisma.patient.update({
    where: { id: patientId },
    data: {
      totalBookings: agg._count._all,
      firstVisit: agg._min.startAt,
      lastVisit: agg._max.startAt,
      concerns: services.map((s) => s.service).join(", ") || null,
    },
  });
}

export async function loadSnapshot(clinic: ClinicRuntime) {
  const [appointments, patients, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: { clinicId: clinic.id },
      include: appointmentInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.patient.findMany({ where: { clinicId: clinic.id }, orderBy: { name: "asc" } }),
    prisma.clinicBlock.findMany({ where: { clinicId: clinic.id }, orderBy: { startAt: "asc" } }),
  ]);

  return {
    clinic: toAdminClinic(clinic),
    appointments: appointments.map((a) => toAppointmentDTO(a)),
    patients: patients.map(toPatientDTO),
    blocks: blocks.map(toBlockDTO),
    serverTime: new Date().toISOString(),
  };
}
