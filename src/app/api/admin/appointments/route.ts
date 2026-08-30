import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { requireClinic, requireClinicSession } from "@/lib/require-admin";
import { appointmentCreateSchema, humanZodMessage } from "@/lib/validation";
import { createOrReuseStaffPatient } from "@/lib/staff-patient";
import { tryStaffBookFast } from "@/lib/staff-book";
import { addMinutes } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import { DEFAULT_CLINIC } from "@/lib/clinic-config";
import { phoneToStore } from "@/lib/phone";
import {
  appointmentInclude,
  insertAppointment,
  recordPatientBooking,
  toAppointmentDTO,
  toAppointmentDTOFromPatient,
} from "@/lib/serializers";

function timingHeader(parts: Record<string, number>) {
  return Object.entries(parts)
    .map(([name, dur]) => `${name};dur=${Math.max(0, Math.round(dur))}`)
    .join(", ");
}

export const GET = withPrismaRoute(async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const rows = await prisma.appointment.findMany({
    where: { clinicId: auth.clinic.id },
    include: appointmentInclude,
    orderBy: { startAt: "asc" },
  });
  return NextResponse.json(rows.map((r) => toAppointmentDTO(r)));
});

export const POST = withPrismaRoute(async function POST(req: Request) {
  const t0 = Date.now();
  const marks: Record<string, number> = {};
  const sessionAuth = await requireClinicSession();
  marks.auth = Date.now() - t0;
  if (sessionAuth.error) return sessionAuth.error;
  const clinicId = sessionAuth.session.clinicId;

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
    const durationMin = data.durationMin;
    const endAt = addMinutes(startAt, durationMin);

    let t = Date.now();
    const fast = await tryStaffBookFast({
      clinicId,
      name: data.name,
      phone: data.phone,
      email: data.email,
      patientId: data.patientId,
      service: data.service,
      startAt,
      endAt,
      durationMin,
      notes: data.notes ?? null,
      status: data.status ?? "APPROVED",
    });
    marks.book = Date.now() - t;

    if (!("fallback" in fast)) {
      marks.total = Date.now() - t0;
      if ("error" in fast) {
        const res = NextResponse.json({ error: fast.error }, { status: fast.status });
        res.headers.set("Server-Timing", timingHeader(marks));
        return res;
      }
      const res = NextResponse.json(fast.appointment);
      res.headers.set("Server-Timing", timingHeader(marks));
      return res;
    }

    const clinic = { ...DEFAULT_CLINIC, id: clinicId };

    t = Date.now();
    const conflict = await assertBookable({ clinic, startAt, endAt, allowOutsideHours: true });
    marks.bookable = Date.now() - t;
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    let patient;
    t = Date.now();
    if (data.patientId) {
      const owned = await prisma.patient.findFirst({
        where: { id: data.patientId, clinicId },
      });
      if (!owned) {
        return NextResponse.json({ error: "Patient not found" }, { status: 400 });
      }
      patient = owned;
    } else {
      if (!data.name) {
        return NextResponse.json({ error: "Patient name is required" }, { status: 400 });
      }
      const result = await createOrReuseStaffPatient({
        clinicId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        concerns: data.service,
        visitAt: startAt,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      patient = result.patient;
    }
    marks.patient = Date.now() - t;

    t = Date.now();
    const created = await insertAppointment({
      clinicId,
      patientId: patient.id,
      service: data.service,
      startAt,
      endAt,
      durationMin,
      notes: data.notes ?? null,
      status: data.status ?? "APPROVED",
    });
    marks.insert = Date.now() - t;

    t = Date.now();
    const brandNew = !data.patientId && !phoneToStore(data.phone);
    if (!brandNew) {
      void recordPatientBooking(patient.id, startAt).catch(() => undefined);
    }
    marks.stats = Date.now() - t;
    marks.total = Date.now() - t0;

    const res = NextResponse.json(toAppointmentDTOFromPatient(created, patient));
    res.headers.set("Server-Timing", timingHeader(marks));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    const res = NextResponse.json({ error: message }, { status: 500 });
    marks.total = Date.now() - t0;
    res.headers.set("Server-Timing", timingHeader(marks));
    return res;
  }
});
