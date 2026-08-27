import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { prescriptionSchema } from "@/lib/validation";
import { appointmentInclude, toAppointmentDTO, toPrescriptionDTO } from "@/lib/serializers";

type Ctx = { params: { id: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rx = await prisma.prescription.findUnique({ where: { appointmentId: params.id } });
  if (!rx) return NextResponse.json({ error: "No prescription yet" }, { status: 404 });
  return NextResponse.json(toPrescriptionDTO(rx));
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const appt = await prisma.appointment.findUnique({ where: { id: params.id } });
  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  try {
    const json = await req.json();
    const parsed = prescriptionSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const followupDate =
      data.followupDate === undefined
        ? undefined
        : data.followupDate
          ? new Date(data.followupDate)
          : null;

    const rx = await prisma.prescription.upsert({
      where: { appointmentId: params.id },
      create: {
        appointmentId: params.id,
        complaints: data.complaints,
        findings: data.findings,
        diagnosis: data.diagnosis,
        medicines: data.medicines,
        advice: data.advice,
        followupNote: data.followupNote ?? null,
      },
      update: {
        complaints: data.complaints,
        findings: data.findings,
        diagnosis: data.diagnosis,
        medicines: data.medicines,
        advice: data.advice,
        followupNote: data.followupNote ?? null,
      },
    });

    const updated = await prisma.appointment.update({
      where: { id: params.id },
      data: {
        rxLink: `/admin/print/rx/${params.id}`,
        followupDate: followupDate === undefined ? undefined : followupDate,
      },
      include: appointmentInclude,
    });

    return NextResponse.json({
      prescription: toPrescriptionDTO(rx),
      appointment: toAppointmentDTO(updated),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
