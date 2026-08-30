import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { humanZodMessage, patientCreateSchema } from "@/lib/validation";
import { createOrReuseStaffPatient } from "@/lib/staff-patient";
import { toPatientDTO } from "@/lib/serializers";

export const GET = withPrismaRoute(async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const rows = await prisma.patient.findMany({
    where: { clinicId: auth.clinic.id },
    orderBy: { name: "asc" },
  });
  return NextResponse.json(rows.map(toPatientDTO));
});

export const POST = withPrismaRoute(async function POST(req: Request) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  try {
    const json = await req.json();
    const parsed = patientCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: humanZodMessage(parsed.error) }, { status: 400 });
    }
    const result = await createOrReuseStaffPatient({
      clinicId: auth.clinic.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      email: parsed.data.email,
      concerns: parsed.data.concerns,
    });
    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json(toPatientDTO(result.patient));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
