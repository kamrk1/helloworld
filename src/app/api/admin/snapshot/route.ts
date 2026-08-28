import { NextResponse } from "next/server";
import { requireClinic } from "@/lib/require-admin";
import { loadSnapshot } from "@/lib/serializers";

export async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const snapshot = await loadSnapshot(auth.clinic);
  return NextResponse.json(snapshot);
}
