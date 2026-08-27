import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bookSchema } from "@/lib/validation";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { addMinutes, istDateTimeFromIsoDate } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import { appointmentInclude, refreshPatientStats, toAppointmentDTO, uniqueRef } from "@/lib/serializers";
import { CLINIC } from "@/lib/clinic-config";

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bookSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const phone = normalizePhone(data.phone);
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
    }

    const startAt = istDateTimeFromIsoDate(data.date, data.time);
    const durationMin = CLINIC.defaultDuration;
    const endAt = addMinutes(startAt, durationMin);
    if (startAt < new Date()) {
      return NextResponse.json({ error: "That slot is in the past" }, { status: 400 });
    }
    const conflict = await assertBookable({ startAt, endAt, allowOutsideHours: false });
    if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });

    const patient = await prisma.patient.upsert({
      where: { phone },
      create: {
        phone,
        name: data.name.trim(),
        email: data.email ? data.email : null,
      },
      update: {
        name: data.name.trim(),
        email: data.email ? data.email : undefined,
      },
    });

    const created = await prisma.appointment.create({
      data: {
        ref: await uniqueRef(startAt),
        patientId: patient.id,
        service: data.service,
        startAt,
        endAt,
        durationMin,
        notes: data.notes || null,
        status: "PENDING",
      },
      include: appointmentInclude,
    });
    await refreshPatientStats(patient.id);

    return NextResponse.json({
      ok: true,
      appointment: toAppointmentDTO({ ...created, prescription: created.prescription ? (created.prescription as never) : null }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
