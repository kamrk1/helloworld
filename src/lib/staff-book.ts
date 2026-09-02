import { prisma } from "./prisma";
import { isPostgresUrl } from "./db-url";
import { phoneToStore, isValidPhone } from "./phone";
import { uniqueRef } from "./serializers";
import type { AppointmentDTO } from "./types";
import type { AppointmentStatus } from "./clinic-config";

function newId() {
  return `c${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
}

type BookRow = {
  bookStatus: string;
  overlapRef: string | null;
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

export type StaffBookResult =
  | { appointment: AppointmentDTO }
  | { error: string; status: number }
  | { fallback: true };

function isRefConflict(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return /23505|clinicId_ref|unique constraint.*ref/i.test(msg);
}

function dtoFromRow(row: BookRow): AppointmentDTO {
  return {
    id: row.id!,
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
    hasInvoice: false,
  };
}

function bookError(row: BookRow | undefined): { error: string; status: number } | null {
  if (!row || row.bookStatus === "clinic") {
    return { error: "Clinic unavailable", status: 403 };
  }
  if (row.bookStatus === "patient") {
    return { error: "Patient not found", status: 400 };
  }
  if (row.bookStatus === "busy" || !row.id) {
    if (row.overlapRef) {
      return { error: `Slot overlaps appointment ${row.overlapRef}`, status: 409 };
    }
    return { error: "That time is blocked (clinic closure)", status: 409 };
  }
  return null;
}

/**
 * Name-only (or existing patientId) staff book in one Postgres statement:
 * clinic enabled + overlap (appts ∪ blocks) + patient + appointment.
 * Stats are written on the patient INSERT/UPDATE. No uniqueRef SELECT.
 * Phone-provided walk-ins still use the Prisma fallback (upsert).
 */
export async function tryStaffBookFast(opts: {
  clinicId: string;
  name?: string;
  phone?: string | null;
  email?: string | null;
  patientId?: string;
  service: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  notes?: string | null;
  status?: string;
}): Promise<StaffBookResult> {
  const phone = phoneToStore(opts.phone);
  if (phone && !isValidPhone(phone)) {
    return { error: "Enter a 10-digit mobile number", status: 400 };
  }
  if (phone || !isPostgresUrl()) {
    return { fallback: true };
  }

  let lastErr: unknown;
  for (let i = 0; i < 8; i++) {
    try {
      const result = opts.patientId
        ? await insertForExistingPatient(opts)
        : await insertNameOnlyWalkIn(opts);
      if ("error" in result || "appointment" in result) return result;
    } catch (err) {
      lastErr = err;
      if (!isRefConflict(err)) throw err;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Could not allocate appointment ref");
}

async function insertNameOnlyWalkIn(opts: {
  clinicId: string;
  name?: string;
  email?: string | null;
  service: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  notes?: string | null;
  status?: string;
}): Promise<Exclude<StaffBookResult, { fallback: true }>> {
  const name = (opts.name ?? "").trim();
  if (!name) {
    return { error: "Patient name is required", status: 400 };
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
      SELECT a.ref AS "overlapRef"
      FROM "Appointment" a
      WHERE a."clinicId" = ${opts.clinicId}
        AND a.status IN ('PENDING', 'APPROVED', 'CONFIRMED')
        AND a."startAt" < ${opts.endAt}
        AND a."endAt" > ${opts.startAt}
      UNION ALL
      SELECT CAST(NULL AS text)
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
        ${patientId}, ${opts.clinicId}, NULL, ${name}, ${email},
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
      (SELECT "overlapRef" FROM busy) AS "overlapRef",
      a.id, a.ref, a."patientId", a.service, a."startAt", a."endAt",
      a."durationMin", a.notes, a.status, a."googleCalEventId", a."rxLink", a."followupDate",
      p.name AS "patientName", p.phone, p.email
    FROM (SELECT 1) AS dummy
    LEFT JOIN ins_a a ON true
    LEFT JOIN ins_p p ON true
  `;

  const row = rows[0];
  const err = bookError(row);
  if (err) return err;
  return { appointment: dtoFromRow(row!) };
}

async function insertForExistingPatient(opts: {
  clinicId: string;
  patientId?: string;
  email?: string | null;
  service: string;
  startAt: Date;
  endAt: Date;
  durationMin: number;
  notes?: string | null;
  status?: string;
}): Promise<Exclude<StaffBookResult, { fallback: true }>> {
  const existingId = opts.patientId!;
  const appointmentId = newId();
  const ref = uniqueRef(opts.clinicId, opts.startAt);
  const status = opts.status ?? "APPROVED";
  const notes = opts.notes ?? null;
  const now = new Date();

  const rows = await prisma.$queryRaw<BookRow[]>`
    WITH
    c AS (
      SELECT id FROM "Clinic" WHERE id = ${opts.clinicId} AND enabled = true
    ),
    owned AS (
      SELECT id, name, phone, email FROM "Patient"
      WHERE id = ${existingId} AND "clinicId" = ${opts.clinicId}
    ),
    busy AS (
      SELECT a.ref AS "overlapRef"
      FROM "Appointment" a
      WHERE a."clinicId" = ${opts.clinicId}
        AND a.status IN ('PENDING', 'APPROVED', 'CONFIRMED')
        AND a."startAt" < ${opts.endAt}
        AND a."endAt" > ${opts.startAt}
      UNION ALL
      SELECT CAST(NULL AS text)
      FROM "ClinicBlock" b
      WHERE b."clinicId" = ${opts.clinicId}
        AND b."startAt" < ${opts.endAt}
        AND b."endAt" > ${opts.startAt}
      LIMIT 1
    ),
    ins_a AS (
      INSERT INTO "Appointment" (
        id, "clinicId", ref, "patientId", service,
        "startAt", "endAt", "durationMin", notes, status,
        "createdAt", "updatedAt"
      )
      SELECT
        ${appointmentId}, ${opts.clinicId}, ${ref}, owned.id, ${opts.service},
        ${opts.startAt}, ${opts.endAt}, ${opts.durationMin}, ${notes}, ${status},
        NOW(), NOW()
      FROM owned
      WHERE EXISTS (SELECT 1 FROM c)
        AND NOT EXISTS (SELECT 1 FROM busy)
      RETURNING
        id, ref, "patientId", service, "startAt", "endAt",
        "durationMin", notes, status, "googleCalEventId", "rxLink", "followupDate"
    ),
    upd AS (
      UPDATE "Patient"
      SET
        "totalBookings" = "totalBookings" + 1,
        "firstVisit" = COALESCE("firstVisit", ${opts.startAt}),
        "lastVisit" = CASE
          WHEN "lastVisit" IS NULL OR "lastVisit" < ${opts.startAt} THEN ${opts.startAt}
          ELSE "lastVisit"
        END,
        "updatedAt" = ${now}
      WHERE id = (SELECT "patientId" FROM ins_a)
      RETURNING id, name, phone, email
    )
    SELECT
      CASE
        WHEN NOT EXISTS (SELECT 1 FROM c) THEN 'clinic'
        WHEN NOT EXISTS (SELECT 1 FROM owned) THEN 'patient'
        WHEN EXISTS (SELECT 1 FROM busy) THEN 'busy'
        ELSE 'ok'
      END AS "bookStatus",
      (SELECT "overlapRef" FROM busy) AS "overlapRef",
      a.id, a.ref, a."patientId", a.service, a."startAt", a."endAt",
      a."durationMin", a.notes, a.status, a."googleCalEventId", a."rxLink", a."followupDate",
      COALESCE(u.name, o.name) AS "patientName",
      COALESCE(u.phone, o.phone) AS phone,
      COALESCE(u.email, o.email) AS email
    FROM (SELECT 1) AS dummy
    LEFT JOIN ins_a a ON true
    LEFT JOIN upd u ON true
    LEFT JOIN owned o ON true
  `;

  const row = rows[0];
  const err = bookError(row);
  if (err) return err;
  return { appointment: dtoFromRow(row!) };
}
