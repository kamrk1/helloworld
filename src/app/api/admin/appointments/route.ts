import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { appointmentCreateSchema, humanZodMessage } from "@/lib/validation";
import { createOrReuseStaffPatient } from "@/lib/staff-patient";
import { addMinutes } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import {
  appointmentInclude,
  insertAppointment,
  recordPatientBooking,
  toAppointmentDTO,
} from "@/lib/serializers";

function timingHeader(parts: Record<string, number>) {
  return Object.entries(parts)
    .map(([name, dur]) => `${name};dur=${Math.max(0, Math.round(dur))}`)
    .join(", ");
}

export async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const rows = await prisma.appointment.findMany({
    where: { clinicId: auth.clinic.id },
    include: appointmentInclude,
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(rows.map((r) => toAppointmentDTO(r)));
}

export async function POST(req: Request) {
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const auth = await requireClinic();
  marks.auth = Date.now() - t0;
  if (auth.error) return auth.error;
  const clinic = auth.clinic;
  try {
    const json = await req.json();
    const parsed = appointmentCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: humanZodMessage(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;
    const startAt = new Date(data.startAt);
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    const durationMin = data.durationMin ?? clinic.defaultDuration;
    const endAt = addMinutes(startAt, durationMin);

    let t = Date.now();
    const conflict = await assertBookable({ clinic, startAt, endAt, allowOutsideHours: true });
    marks.bookable = Date.now() - t;
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    let patientId = data.patientId;
    t = Date.now();
    if (patientId) {
      const owned = await prisma.patient.findFirst({
        where: { id: patientId, clinicId: clinic.id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ error: "Patient not found" }, { status: 400 });
      }
    } else {
      if (!data.name) {
        return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
      }
      const result = await createOrReuseStaffPatient({
        clinicId: clinic.id,
        name: data.name,
        phone: data.phone,
        email: data.email,
        concerns: data.service,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      patientId = result.patient.id;
    }
    marks.patient = Date.now() - t;

    t = Date.now();
    const created = await insertAppointment({
      clinicId: clinic.id,
      patientId,
      service: data.service,
      startAt,
      endAt,
      durationMin,
      notes: data.notes ?? null,
      status: data.status ?? "APPROVED",
    });
    marks.insert = Date.now() - t;

    t = Date.now();
    await recordPatientBooking(patientId, startAt);
    marks.stats = Date.now() - t;
    marks.total = Date.now() - t0;

    const res = NextResponse.json(toAppointmentDTO(created));
    res.headers.set("Server-Timing", timingHeader(marks));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    const res = NextResponse.json({ error: message }, { status: 500 });
    marks.total = Date.now() - t0;
    res.headers.set("Server-Timing", timingHeader(marks));
    return res;
  }
}
