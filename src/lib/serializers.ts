import type { Appointment, Patient, ClinicBlock, Prescription } from "@prisma/client";
import type { AppointmentStatus } from "./clinic-config";
import type { AppointmentDTO, BlockDTO, PatientDTO, PrescriptionDTO } from "./types";
import { prisma } from "./prisma";
import { getISTParts } from "./datetime";

type ApptWithPatient = Appointment & {
  patient: Patient;
  prescription?: { id: string } | null;
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

export function makeRef(date: Date) {
  const p = getISTParts(date);
  const ymd = `${p.year}${String(p.month).padStart(2, "0")}${String(p.day).padStart(2, "0")}`;
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SDC-${ymd}-${rand}`;
}

export async function uniqueRef(date: Date) {
  for (let i = 0; i < 8; i++) {
    const ref = makeRef(date);
    const exists = await prisma.appointment.findUnique({ where: { ref }, select: { id: true } });
    if (!exists) return ref;
  }
  return `SDC-${Date.now().toString(36).toUpperCase()}`;
}

export async function refreshPatientStats(patientId: string) {
  const appts = await prisma.appointment.findMany({
    where: { patientId, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
    orderBy: { startAt: "asc" },
    select: { startAt: true, service: true },
  });
  const concerns = Array.from(new Set(appts.map((a) => a.service))).join(", ");
  return prisma.patient.update({
    where: { id: patientId },
    data: {
      totalBookings: appts.length,
      firstVisit: appts[0]?.startAt ?? null,
      lastVisit: appts[appts.length - 1]?.startAt ?? null,
      concerns: concerns || null,
    },
  });
}

export const appointmentInclude = {
  patient: true,
  prescription: { select: { id: true } },
} as const;

export async function loadSnapshot() {
  const [appointments, patients, blocks] = await Promise.all([
    prisma.appointment.findMany({
      include: appointmentInclude,
      orderBy: { startAt: "asc" },
    }),
    prisma.patient.findMany({ orderBy: { name: "asc" } }),
    prisma.clinicBlock.findMany({ orderBy: { startAt: "asc" } }),
  ]);

  return {
    appointments: appointments.map((a) => toAppointmentDTO(a)),
    patients: patients.map(toPatientDTO),
    blocks: blocks.map(toBlockDTO),
    serverTime: new Date().toISOString(),
  };
}
