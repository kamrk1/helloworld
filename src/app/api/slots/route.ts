import { NextResponse } from "next/server";
import { clinicIdFromRequest, publicClinicOrError, slotsJson } from "@/lib/public-booking";
import { withPrismaRoute } from "@/lib/prisma";

/** Compatibility shim: defaults to DEFAULT_CLINIC_ID so old /api/slots bookmarks keep working. */
export const GET = withPrismaRoute(async function GET(req: Request) {
  const found = await publicClinicOrError(clinicIdFromRequest(req), { requireBooking: true });
  if (found.error) return found.error;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const duration = Number(url.searchParams.get("duration") ?? found.clinic.defaultDuration);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Query date=YYYY-MM-DD is required" }, { status: 400 });
  }
  return NextResponse.json(await slotsJson(found.clinic, date, duration));
});
