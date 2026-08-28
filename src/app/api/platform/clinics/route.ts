import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatform } from "@/lib/require-admin";
import { platformCreateClinicSchema } from "@/lib/validation";
import { clinicPasswordDigest } from "@/lib/auth";
import {
  DEFAULT_CLINIC,
  DEFAULT_FLAGS,
  DEFAULT_RX,
  DEFAULT_SERVICES,
} from "@/lib/clinic-config";
import { toClinicRuntime } from "@/lib/clinic-runtime";
import { ensureKnownClinics } from "@/lib/tenant";

function platformClinicJson(row: Awaited<ReturnType<typeof prisma.clinic.findMany>>[number]) {
  const runtime = toClinicRuntime(row);
  return {
    id: runtime.id,
    name: runtime.name,
    shortName: runtime.shortName,
    tagline: runtime.tagline,
    enabled: runtime.enabled,
    hasPassword: Boolean(row.passwordDigest),
    timezone: runtime.timezone,
    hours: runtime.hours,
    slotMinutes: runtime.slotMinutes,
    defaultDuration: runtime.defaultDuration,
    flags: runtime.flags,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET() {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  await ensureKnownClinics();
  const rows = await prisma.clinic.findMany({ orderBy: { createdAt: "asc" } });
  return NextResponse.json(rows.map(platformClinicJson));
}

export async function POST(req: Request) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  try {
    const json = await req.json();
    const parsed = platformCreateClinicSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const existing = await prisma.clinic.findUnique({ where: { id: data.slug } });
    if (existing) {
      return NextResponse.json({ error: "That clinic ID is already taken" }, { status: 409 });
    }
    const defaultDuration = data.defaultDuration ?? DEFAULT_CLINIC.defaultDuration;
    const slotMinutes = data.slotMinutes ?? (defaultDuration <= 15 ? 15 : DEFAULT_CLINIC.slotMinutes);
    const durations = data.durations?.length
      ? data.durations
      : Array.from(new Set([defaultDuration, defaultDuration * 2, defaultDuration * 3])).filter((n) => n <= 480);
    const flags = { ...DEFAULT_FLAGS, ...data.flags };
    const row = await prisma.clinic.create({
      data: {
        id: data.slug,
        name: data.name,
        shortName: data.shortName || data.slug.toUpperCase(),
        tagline: data.tagline || "",
        passwordDigest: clinicPasswordDigest(data.slug, data.password),
        timezone: data.timezone || DEFAULT_CLINIC.timezone,
        hoursOpen: data.hoursOpen || DEFAULT_CLINIC.hours.start,
        hoursClose: data.hoursClose || DEFAULT_CLINIC.hours.end,
        closedWeekdays: JSON.stringify(data.closedWeekdays ?? [...DEFAULT_CLINIC.closedWeekdays]),
        slotMinutes,
        defaultDuration,
        durationsJson: JSON.stringify(durations),
        servicesJson: JSON.stringify([...DEFAULT_SERVICES]),
        brandPrimary: DEFAULT_CLINIC.brand.primary,
        brandAccent: DEFAULT_CLINIC.brand.accent,
        flagsJson: JSON.stringify(flags),
        rxJson: JSON.stringify(DEFAULT_RX),
        enabled: true,
      },
    });
    return NextResponse.json(platformClinicJson(row), { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
