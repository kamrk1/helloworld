import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { appointmentCreateSchema, humanZodMessage } from "@/lib/validation";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { addMinutes } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import {
  appointmentInclude,
  refreshPatientStats,
  toAppointmentDTO,
  uniqueRef,
} from "@/lib/serializers";

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
  const auth = await requireClinic();
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

    const conflict = await assertBookable({ clinic, startAt, endAt, allowOutsideHours: true });
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    let patientId = data.patientId;
    if (patientId) {
      const owned = await prisma.patient.findFirst({
        where: { id: patientId, clinicId: clinic.id },
        select: { id: true },
      });
      if (!owned) {
        return NextResponse.json({ error: "Patient not found" }, { status: 400 });
      }
    } else {
      if (!data.name || !data.phone) {
        return NextResponse.json({ error: "Patient name and phone are required" }, { status: 400 });
      }
      const phone = normalizePhone(data.phone);
      if (!isValidPhone(phone)) {
        return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
      }
      const patient = await prisma.patient.upsert({
        where: { clinicId_phone: { clinicId: clinic.id, phone } },
        create: {
          clinicId: clinic.id,
          phone,
          name: data.name.trim(),
          email: data.email ? data.email : null,
        },
        update: { name: data.name.trim(), email: data.email ? data.email : undefined },
      });
      patientId = patient.id;
    }

    const created = await prisma.appointment.create({
      data: {
        clinicId: clinic.id,
        ref: await uniqueRef(clinic.id, startAt),
        patientId,
        service: data.service,
        startAt,
        endAt,
        durationMin,
        notes: data.notes ?? null,
        status: data.status ?? "APPROVED",
      },
      include: appointmentInclude,
    });
    await refreshPatientStats(patientId);

    return NextResponse.json(toAppointmentDTO(created));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
