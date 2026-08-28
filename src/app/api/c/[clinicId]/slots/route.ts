import { NextResponse } from "next/server";
import { publicClinicOrError, slotsJson } from "@/lib/public-booking";

type Ctx = { params: { clinicId: string } };

export async function GET(req: Request, { params }: Ctx) {
  const found = await publicClinicOrError(params.clinicId, { requireBooking: true });
  if (found.error) return found.error;
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const duration = Number(url.searchParams.get("duration") ?? found.clinic.defaultDuration);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Query date=YYYY-MM-DD is required" }, { status: 400 });
  }
  return NextResponse.json(await slotsJson(found.clinic, date, duration));
}
