import { NextResponse } from "next/server";
import { requireClinic } from "@/lib/require-admin";
import { loadSnapshot } from "@/lib/serializers";
import { withPrismaRoute } from "@/lib/prisma";

export const GET = withPrismaRoute(async function GET() {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const snapshot = await loadSnapshot(auth.clinic);
  return NextResponse.json(snapshot);
});
