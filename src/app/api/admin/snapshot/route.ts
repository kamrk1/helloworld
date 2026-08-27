import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { loadSnapshot } from "@/lib/serializers";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const snapshot = await loadSnapshot();
  return NextResponse.json(snapshot);
}
