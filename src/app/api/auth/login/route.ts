import { NextResponse } from "next/server";
import { clinicPasswordDigest, checkClinicPassword, createClinicSessionToken, sessionCookie } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ensureSdcClinic } from "@/lib/tenant";
import { defaultClinicId, isValidClinicSlug } from "@/lib/clinic-config";

export async function POST(req: Request) {
  try {
    await ensureSdcClinic();
    const body = (await req.json()) as { password?: string; clinicId?: string };
    const password = body.password ?? "";
    const clinicId = (body.clinicId || defaultClinicId()).trim().toLowerCase();
    if (!isValidClinicSlug(clinicId)) {
      return NextResponse.json({ error: "Unknown clinic" }, { status: 401 });
    }
    const row = await prisma.clinic.findUnique({ where: { id: clinicId } });
    if (!row || !row.enabled) {
      return NextResponse.json({ error: "Invalid clinic ID or password" }, { status: 401 });
    }
    if (!checkClinicPassword(clinicId, password, row.passwordDigest)) {
      return NextResponse.json({ error: "Invalid clinic ID or password" }, { status: 401 });
    }
    if (!row.passwordDigest) {
      await prisma.clinic.update({
        where: { id: clinicId },
        data: { passwordDigest: clinicPasswordDigest(clinicId, password) },
      });
    }
    const res = NextResponse.json({ ok: true, clinicId, role: "clinic" as const });
    res.cookies.set(sessionCookie(createClinicSessionToken(clinicId)));
    return res;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
