import { NextResponse } from "next/server";
import { publicClinicOrError } from "@/lib/public-booking";
import { toPublicClinic } from "@/lib/clinic-runtime";

type Ctx = { params: { clinicId: string } };

export async function GET(_req: Request, { params }: Ctx) {
  const found = await publicClinicOrError(params.clinicId);
  if (found.error) return found.error;
  return NextResponse.json(toPublicClinic(found.clinic));
}
