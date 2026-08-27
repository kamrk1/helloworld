import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { appointmentPatchSchema } from "@/lib/validation";
import { addMinutes } from "@/lib/datetime";
import { assertBookable } from "@/lib/slots";
import { appointmentInclude, refreshPatientStats, toAppointmentDTO } from "@/lib/serializers";
import { normalizePhone, isValidPhone } from "@/lib/phone";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const row = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { ...appointmentInclude, prescription: true },
  });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(toAppointmentDTO(row));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const existing = await prisma.appointment.findUnique({
    where: { id: params.id },
    include: { patient: true },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const json = await req.json();
    const parsed = appointmentPatchSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
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
        startAt,
        endAt,
        excludeAppointmentId: existing.id,
        allowOutsideHours: true,
      });
      if (conflict) return NextResponse.json({ error: conflict }, { status: 409 });
    }

    if (data.name || data.phone || data.email !== undefined) {
      const phone = data.phone ? normalizePhone(data.phone) : existing.patient.phone;
      if (data.phone && !isValidPhone(phone)) {
        return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
      }
      await prisma.patient.update({
        where: { id: existing.patientId },
        data: {
          name: data.name ?? undefined,
          phone: data.phone ? phone : undefined,
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
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const existing = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.appointment.delete({ where: { id: params.id } });
  await refreshPatientStats(existing.patientId);
  return NextResponse.json({ ok: true });
}
