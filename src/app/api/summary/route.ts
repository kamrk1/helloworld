import { NextResponse } from "next/server";
import { getNetWorthSummary } from "@/lib/summary";

export async function GET() {
  try {
    const summary = await getNetWorthSummary();
    return NextResponse.json(summary);
  } catch (error) {
    console.error("GET /api/summary:", error);
    return NextResponse.json({ error: "Failed to compute summary" }, { status: 500 });
  }
}
