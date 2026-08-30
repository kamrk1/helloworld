import { prisma } from "./prisma";
import { isPostgresUrl } from "./db-url";
import { phoneToStore, isValidPhone } from "./phone";
import { uniqueRef } from "./serializers";
import type { AppointmentDTO } from "./types";
import type { AppointmentStatus } from "./clinic-config";

function newId() {
  return `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

type BookRow = {
  bookStatus: string;
  id: string | null;
  ref: string | null;
  patientId: string | null;
  service: string | null;
  startAt: Date | null;
  endAt: Date | null;
  durationMin: number | null;
  notes: string | null;
  status: string | null;
  googleCalEventId: string | null;
  rxLink: string | null;
  followupDate: Date | null;
  patientName: string | null;
  phone: string | null;
  email: string | null;
};

export async function bookNameOnlyWalkIn(opts: {
  clinicId: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  service: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  notes?: string | null;
  status?: string;
}): Promise<{ error: string; status: number } | { appointment: AppointmentDTO }> {
  const phone = phoneToStore(opts.phone);
  if (phone && !isValidPhone(phone)) {
    return { error: "Enter a 10-digit mobile number", status: 400 };
  }
  if (phone || !isPostgresUrl()) {
    return { error: "fallback", status: 0 };
  }

  const patientId = newId();
  const appointmentId = newId();
  const ref = uniqueRef(opts.clinicId, opts.startAt);
  const status = opts.status ?? "APPROVED";
  const email = opts.email ? opts.email : null;
  const notes = opts.notes ?? null;

  const rows = await prisma.$queryRaw<BookRow[]>`
    WITH
    c AS (
      SELECT id FROM "Clinic" WHERE id = ${opts.clinicId} AND enabled = true
    ),
    busy AS (
      SELECT 1 AS x
      FROM "Appointment" a
      WHERE a."clinicId" = ${opts.clinicId}
        AND a.status IN ('PENDING', 'APPROVED', 'CONFIRMED')
        AND a."startAt" < ${opts.endAt}
        AND a."endAt" > ${opts.startAt}
      UNION ALL
      SELECT 1
      FROM "ClinicBlock" b
      WHERE b."clinicId" = ${opts.clinicId}
        AND b."startAt" < ${opts.endAt}
        AND b."endAt" > ${opts.startAt}
      LIMIT 1
    ),
    ins_p AS (
      INSERT INTO "Patient" (
        id, "clinicId", phone, name, email,
        "totalBookings", "firstVisit", "lastVisit", concerns,
        "createdAt", "updatedAt"
      )
      SELECT
        ${patientId}, ${opts.clinicId}, NULL, ${opts.name}, ${email},
        1, ${opts.startAt}, ${opts.startAt}, ${opts.service},
        NOW(), NOW()
      WHERE EXISTS (SELECT 1 FROM c)
        AND NOT EXISTS (SELECT 1 FROM busy)
      RETURNING id, name, phone, email
    ),
    ins_a AS (
      INSERT INTO "Appointment" (
        id, "clinicId", ref, "patientId", service,
        "startAt", "endAt", "durationMin", notes, status,
        "createdAt", "updatedAt"
      )
      SELECT
        ${appointmentId}, ${opts.clinicId}, ${ref}, ins_p.id, ${opts.service},
        ${opts.startAt}, ${opts.endAt}, ${opts.durationMin}, ${notes}, ${status},
        NOW(), NOW()
      FROM ins_p
      RETURNING
        id, ref, "patientId", service, "startAt", "endAt",
        "durationMin", notes, status, "googleCalEventId", "rxLink", "followupDate"
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM c) THEN 'clinic'
        WHEN EXISTS (SELECT 1 FROM busy) THEN 'busy'
        ELSE 'ok'
      END AS "bookStatus",
      a.id, a.ref, a."patientId", a.service, a."startAt", a."endAt",
      a."durationMin", a.notes, a.status, a."googleCalEventId", a."rxLink", a."followupDate",
      p.name AS "patientName", p.phone, p.email
    FROM (SELECT 1) AS dummy
    LEFT JOIN ins_a a ON true
    LEFT JOIN ins_p p ON true
  `;

  const row = rows[0];
  if (!row || row.bookStatus === "clinic") {
    return { error: "Clinic unavailable", status: 403 };
  }
  if (row.bookStatus === "busy" || !row.id) {
    return { error: "That time is blocked or already booked", status: 409 };
  }

  const appointment: AppointmentDTO = {
    id: row.id,
    ref: row.ref!,
    patientId: row.patientId!,
    patientName: row.patientName!,
    phone: row.phone,
    email: row.email,
    service: row.service!,
    startAt: new Date(row.startAt!).toISOString(),
    endAt: new Date(row.endAt!).toISOString(),
    durationMin: row.durationMin!,
    notes: row.notes,
    status: (row.status ?? "APPROVED") as AppointmentStatus,
    googleCalEventId: row.googleCalEventId,
    rxLink: row.rxLink,
    followupDate: row.followupDate ? new Date(row.followupDate).toISOString() : null,
    hasPrescription: false,
  };
  return { appointment };
}
