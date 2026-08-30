import { NextResponse } from "next/server";
import { prisma } from "./prisma";
import { bookSchema, humanZodMessage } from "./validation";
import { normalizePhone, isValidPhone } from "./phone";
import { addMinutes, istDateTimeFromIsoDate } from "./datetime";
import { assertBookable, listSlotsForDate } from "./slots";
import { insertAppointment, recordPatientBooking, toAppointmentDTOFromPatient } from "./serializers";
import { requireEnabledClinic } from "./tenant";
import { defaultClinicId, isValidClinicSlug } from "./clinic-config";
import { toPublicClinic } from "./clinic-runtime";
import type { ClinicRuntime } from "./clinic-config";

export async function publicClinicOrError(
  clinicId: string,
  opts?: { requireBooking?: boolean },
): Promise<{ error: NextResponse; clinic?: undefined } | { error?: undefined; clinic: ClinicRuntime }> {
  const id = clinicId.trim().toLowerCase();
  if (!isValidClinicSlug(id)) {
    return { error: NextResponse.json({ error: "Unknown clinic" }, { status: 404 }) };
  }
  const clinic = await requireEnabledClinic(id);
  if (!clinic) {
    return { error: NextResponse.json({ error: "Unknown clinic" }, { status: 404 }) };
  }
  if (opts?.requireBooking && !clinic.flags.publicBooking) {
    return { error: NextResponse.json({ error: "Online booking is not enabled" }, { status: 403 }) };
  }
  return { clinic };
}

export function clinicIdFromRequest(req: Request, fallback = defaultClinicId()) {
  const url = new URL(req.url);
  const fromQuery = url.searchParams.get("clinicId") || url.searchParams.get("clinic");
  return (fromQuery || fallback).trim().toLowerCase();
}

export async function slotsJson(clinic: ClinicRuntime, date: string, durationMin?: number) {
  const duration = Number.isFinite(durationMin) && durationMin! > 0 ? durationMin! : clinic.defaultDuration;
  const day = await listSlotsForDate(clinic, date, duration);
  return { ...day, timezone: clinic.timezone, clinicId: clinic.id, duration };
}

export async function createPublicBooking(clinic: ClinicRuntime, json: unknown) {
  const parsed = bookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: humanZodMessage(parsed.error) }, { status: 400 });
  }
  const data = parsed.data;
  const phone = normalizePhone(data.phone);
  if (!isValidPhone(phone)) {
    return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
  }
  if (!clinic.services.includes(data.service) && data.service !== "Consultation") {
    // Allow listed services; still accept unknown labels the clinic typed historically.
  }

  const startAt = istDateTimeFromIsoDate(data.date, data.time);
  const durationMin = clinic.defaultDuration;
  const endAt = addMinutes(startAt, durationMin);
  if (startAt < new Date()) {
    return NextResponse.json({ error: "That slot is in the past" }, { status: 400 });
  }
  const conflict = await assertBookable({ clinic, startAt, endAt, allowOutsideHours: false });
  if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

  const patient = await prisma.patient.upsert({
    where: { clinicId_phone: { clinicId: clinic.id, phone } },
    create: {
      clinicId: clinic.id,
      phone,
      name: data.name.trim(),
      email: data.email ? data.email : null,
    },
    update: {
      name: data.name.trim(),
      email: data.email ? data.email : undefined,
    },
  });

  const created = await insertAppointment({
    clinicId: clinic.id,
    patientId: patient.id,
    service: data.service,
    startAt,
    endAt,
    durationMin,
    notes: data.notes || null,
    status: clinic.flags.pendingApproval ? "PENDING" : "APPROVED",
  });
  await recordPatientBooking(patient.id, startAt);

  return NextResponse.json({
    ok: true,
    clinic: toPublicClinic(clinic),
    appointment: toAppointmentDTOFromPatient(created, patient),
  });
}
