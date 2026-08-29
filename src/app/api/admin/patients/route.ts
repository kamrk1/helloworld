import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { humanZodMessage, patientCreateSchema } from "@/lib/validation";
import { normalizePhone, isValidPhone } from "@/lib/phone";
import { toPatientDTO } from "@/lib/serializers";

export async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const rows = await prisma.patient.findMany({
    where: { clinicId: auth.clinic.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rows.map(toPatientDTO));
}

export async function POST(req: Request) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  try {
    const json = await req.json();
    const parsed = patientCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: humanZodMessage(parsed.error) }, { status: 400 });
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Enter a 10-digit mobile number" }, { status: 400 });
    }
    const created = await prisma.patient.upsert({
      where: { clinicId_phone: { clinicId: auth.clinic.id, phone } },
      create: {
        clinicId: auth.clinic.id,
        phone,
        name: parsed.data.name,
        email: parsed.data.email ? parsed.data.email : null,
        concerns: parsed.data.concerns ?? null,
      },
      update: {
        name: parsed.data.name,
        email: parsed.data.email ? parsed.data.email : undefined,
        concerns: parsed.data.concerns ?? undefined,
      },
    });
    return NextResponse.json(toPatientDTO(created));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
