import { NextResponse } from "next/server";
import { clinicIdFromRequest, createPublicBooking, publicClinicOrError } from "@/lib/public-booking";

/** Compatibility shim for the first customer (DEFAULT_CLINIC_ID). New tenants should POST /api/c/{slug}/book. */
export async function POST(req: Request) {
  try {
    const json = (await req.json()) as { clinicId?: string };
    const clinicId = typeof json.clinicId === "string" ? json.clinicId : clinicIdFromRequest(req);
    const found = await publicClinicOrError(clinicId, { requireBooking: true });
    if (found.error) return found.error;
    return createPublicBooking(found.clinic, json);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Booking failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
