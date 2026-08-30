import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { appointmentPatchSchema, humanZodMessage } from "@/lib/validation";
import { addMinutes } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import { appointmentInclude, refreshPatientStats, toAppointmentDTO } from "@/lib/serializers";
import { normalizePhone, isValidPhone } from "@/lib/phone";

type Ctx = { params: { id: string } };

export const GET = withPrismaRoute(async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const row = await prisma.appointment.findFirst({
    where: { id: params.id, clinicId: auth.clinic.id },
    include: { ...appointmentInclude, prescription: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toAppointmentDTO(row));
});

export const PATCH = withPrismaRoute(async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const clinic = auth.clinic;
  const existing = await prisma.appointment.findFirst({
    where: { id: params.id, clinicId: clinic.id },
    include: { patient: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const json = await req.json();
    const parsed = appointmentPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: humanZodMessage(parsed.error) }, { status: 400 });
    }
    const data = parsed.data;
    const startAt = data.startAt ? new Date(data.startAt) : existing.startAt;
    if (Number.isNaN(startAt.getTime())) {
      return NextResponse.json({ error: "Invalid start time" }, { status: 400 });
    }
    const durationMin = data.durationMin ?? existing.durationMin;
    const endAt = addMinutes(startAt, durationMin);

    const timeChanged =
      startAt.getTime() !== existing.startAt.getTime() || durationMin !== existing.durationMin;
    const nextStatus = data.status ?? existing.status;
    const stillActive = ["PENDING", "APPROVED", "CONFIRMED"].includes(nextStatus);

    if (timeChanged && stillActive) {
      const conflict = await assertBookable({
        clinic,
        startAt,
        endAt,
        excludeAppointmentId: existing.id,
        allowOutsideHours: true,
      });
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    }

    if (data.name || data.phone || data.email !== undefined) {
      if (data.phone && !isValidPhone(data.phone)) {
        return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
      }
      await prisma.patient.update({
        where: { id: existing.patientId },
        data: {
          name: data.name ?? undefined,
          phone: data.phone ? normalizePhone(data.phone) : undefined,
          email: data.email === undefined ? undefined : data.email || null,
        },
      });
    }

    const followupDate =
      data.followupDate === undefined
        ? undefined
        : data.followupDate
          ? new Date(data.followupDate)
          : null;

    const updated = await prisma.appointment.update({
      where: { id: existing.id },
      data: {
        service: data.service,
        startAt,
        endAt,
        durationMin,
        notes: data.notes === undefined ? undefined : data.notes,
        status: data.status,
        followupDate,
        googleCalEventId: data.googleCalEventId === undefined ? undefined : data.googleCalEventId,
        rxLink: data.rxLink === undefined ? undefined : data.rxLink,
      },
      include: appointmentInclude,
    });
    await refreshPatientStats(existing.patientId);
    return NextResponse.json(toAppointmentDTO(updated));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});

export const DELETE = withPrismaRoute(async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const existing = await prisma.appointment.findFirst({
    where: { id: params.id, clinicId: auth.clinic.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.appointment.delete({ where: { id: params.id } });
  await refreshPatientStats(existing.patientId);
  return NextResponse.json({ ok: true });
});
