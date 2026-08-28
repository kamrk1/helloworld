import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { clinicSettingsSchema } from "@/lib/validation";
import { toAdminClinic, toClinicRuntime } from "@/lib/clinic-runtime";
import { getClinicRow } from "@/lib/tenant";

export async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  return NextResponse.json(toAdminClinic(auth.clinic));
}

export async function PATCH(req: Request) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  try {
    const json = await req.json();
    const parsed = clinicSettingsSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const currentRx = auth.clinic.rx;
    const nextRx = data.rx ? { ...currentRx, ...data.rx } : undefined;

    await prisma.clinic.update({
      where: { id: auth.clinic.id },
      data: {
        name: data.name,
        shortName: data.shortName,
        tagline: data.tagline,
        timezone: data.timezone,
        hoursOpen: data.hoursOpen,
        hoursClose: data.hoursClose,
        closedWeekdays: data.closedWeekdays ? JSON.stringify(data.closedWeekdays) : undefined,
        slotMinutes: data.slotMinutes,
        defaultDuration: data.defaultDuration,
        durationsJson: data.durations ? JSON.stringify(data.durations) : undefined,
        servicesJson: data.services ? JSON.stringify(data.services) : undefined,
        phone: data.phone,
        address: data.address,
        reviewUrl: data.reviewUrl,
        brandPrimary: data.brandPrimary,
        brandAccent: data.brandAccent,
        rxJson: nextRx ? JSON.stringify(nextRx) : undefined,
      },
    });
    const row = await getClinicRow(auth.clinic.id);
    if (!row) return NextResponse.json({ error: "Clinic missing" }, { status: 404 });
    return NextResponse.json(toAdminClinic(toClinicRuntime(row)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
