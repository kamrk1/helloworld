import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";

type Ctx = { params: { id: string } };

export const DELETE = withPrismaRoute(async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireClinic("closures");
  if (auth.error) return auth.error;
  const existing = await prisma.clinicBlock.findFirst({
    where: { id: params.id, clinicId: auth.clinic.id },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.clinicBlock.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
});
