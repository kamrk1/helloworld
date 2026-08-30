import type { AppointmentStatus } from "./clinic-config";
import type { AdminClinicDTO } from "./clinic-runtime";

export type AppointmentDTO = {
  id: string;
  ref: string;
  patientId: string;
  patientName: string;
  phone: string | null;
  email: string | null;
  service: string;
  startAt: string;
  endAt: string;
  durationMin: number;
  notes: string | null;
  status: AppointmentStatus;
  googleCalEventId: string | null;
  rxLink: string | null;
  followupDate: string | null;
  hasPrescription: boolean;
};

export type PatientDTO = {
  id: string;
  phone: string | null;
  name: string;
  email: string | null;
  firstVisit: string | null;
  lastVisit: string | null;
  totalBookings: number;
  concerns: string | null;
};

export type BlockDTO = {
  id: string;
  startAt: string;
  endAt: string;
  allDay: boolean;
  reason: string | null;
};

export type PrescriptionDTO = {
  id: string;
  appointmentId: string;
  complaints: string;
  findings: string;
  diagnosis: string;
  medicines: string;
  advice: string;
  followupNote: string | null;
};

export type SnapshotDTO = {
  clinic: AdminClinicDTO;
  appointments: AppointmentDTO[];
  patients: PatientDTO[];
  blocks: BlockDTO[];
  serverTime: string;
};

export function snapshotCacheKey(clinicId: string) {
  return `clinic-snapshot-v2:${clinicId}`;
}
