import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });
  if (session.role === "platform") {
    return NextResponse.json({ authenticated: true, role: "platform" });
  }
  return NextResponse.json({ authenticated: true, role: "clinic", clinicId: session.clinicId });
}
