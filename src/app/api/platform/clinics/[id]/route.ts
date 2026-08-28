import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requirePlatform } from "@/lib/require-admin";
import { platformPatchClinicSchema } from "@/lib/validation";
import { clinicPasswordDigest } from "@/lib/auth";
import { parseFlags } from "@/lib/clinic-config";
import { toClinicRuntime } from "@/lib/clinic-runtime";

type Ctx = { params: { id: string } };

function platformClinicJson(row: NonNullable<Awaited<ReturnType<typeof prisma.clinic.findUnique>>>) {
  const runtime = toClinicRuntime(row);
  return {
    id: runtime.id,
    name: runtime.name,
    shortName: runtime.shortName,
    tagline: runtime.tagline,
    enabled: runtime.enabled,
    timezone: runtime.timezone,
    hours: runtime.hours,
    slotMinutes: runtime.slotMinutes,
    defaultDuration: runtime.defaultDuration,
    flags: runtime.flags,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function GET(_req: Request, { params }: Ctx) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  const row = await prisma.clinic.findUnique({ where: { id: params.id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(platformClinicJson(row));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requirePlatform();
  if (auth.error) return auth.error;
  const existing = await prisma.clinic.findUnique({ where: { id: params.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const json = await req.json();
    const parsed = platformPatchClinicSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;
    const nextFlags = data.flags ? { ...parseFlags(existing.flagsJson), ...data.flags } : undefined;
    const row = await prisma.clinic.update({
      where: { id: params.id },
      data: {
        enabled: data.enabled,
        name: data.name,
        passwordDigest: data.password ? clinicPasswordDigest(params.id, data.password) : undefined,
        flagsJson: nextFlags ? JSON.stringify(nextFlags) : undefined,
      },
    });
    return NextResponse.json(platformClinicJson(row));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
