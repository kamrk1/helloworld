import { NextResponse } from "next/server";
import { listSlotsForDate } from "@/lib/slots";
import { CLINIC } from "@/lib/clinic-config";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const date = url.searchParams.get("date");
  const duration = Number(url.searchParams.get("duration") ?? CLINIC.defaultDuration);
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Query date=YYYY-MM-DD is required" }, { status: 400 });
  }
  const slots = await listSlotsForDate(date, Number.isFinite(duration) ? duration : 30);
  return NextResponse.json({ date, slots, timezone: CLINIC.timezone });
}
