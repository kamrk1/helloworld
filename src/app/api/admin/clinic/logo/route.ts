import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { toAdminClinic, toClinicRuntime } from "@/lib/clinic-runtime";
import { getClinicRow } from "@/lib/tenant";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/svg+xml"]);
const MAX_BYTES = 400 * 1024;

export async function POST(req: Request) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  try {
    const form = await req.formData();
    const file = form.get("logo");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "Choose an image file" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: "Logo must be under 400 KB" }, { status: 400 });
    }
    const mime = file.type || "image/png";
    if (!ALLOWED.has(mime)) {
      return NextResponse.json({ error: "Use PNG, JPEG, WebP, or SVG" }, { status: 400 });
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    await prisma.clinic.update({
      where: { id: auth.clinic.id },
      data: { logoBytes: bytes, logoMime: mime },
    });
    const row = await getClinicRow(auth.clinic.id);
    if (!row) return NextResponse.json({ error: "Clinic missing" }, { status: 404 });
    return NextResponse.json(toAdminClinic(toClinicRuntime(row)));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  await prisma.clinic.update({
    where: { id: auth.clinic.id },
    data: { logoBytes: null, logoMime: null },
  });
  const row = await getClinicRow(auth.clinic.id);
  if (!row) return NextResponse.json({ error: "Clinic missing" }, { status: 404 });
  return NextResponse.json(toAdminClinic(toClinicRuntime(row)));
}
