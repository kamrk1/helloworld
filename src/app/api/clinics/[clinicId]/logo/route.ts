import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { isValidClinicSlug } from "@/lib/clinic-config";

type Ctx = { params: { clinicId: string } };

export const GET = withPrismaRoute(async function GET(_req: Request, { params }: Ctx) {
  const id = params.clinicId.trim().toLowerCase();
  if (!isValidClinicSlug(id)) {
    return new NextResponse(null, { status: 404 });
  }
  const row = await prisma.clinic.findUnique({
    where: { id },
    select: { logoBytes: true, logoMime: true, enabled: true },
  });
  if (!row?.enabled || !row.logoBytes || !row.logoMime) {
    return new NextResponse(null, { status: 404 });
  }
  const body = Uint8Array.from(row.logoBytes);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": row.logoMime,
      "Cache-Control": "public, max-age=300",
    },
  });
});
