import { NextResponse } from "next/server";
import { createPublicBooking, publicClinicOrError } from "@/lib/public-booking";

type Ctx = { params: { clinicId: string } };

export async function POST(req: Request, { params }: Ctx) {
  const found = await publicClinicOrError(params.clinicId, { requireBooking: true });
  if (found.error) return found.error;
  try {
    const json = await req.json();
    return createPublicBooking(found.clinic, json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
