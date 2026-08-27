import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-admin";
import { blockCreateSchema } from "@/lib/validation";
import { toBlockDTO } from "@/lib/serializers";
import { startOfDayIST, endOfDayIST } from "@/lib/datetime";
import { findConflicts } from "@/lib/slots";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const rows = await prisma.clinicBlock.findMany({ orderBy: { startAt: "asc" } });
  return NextResponse.json(rows.map(toBlockDTO));
}

export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const json = await req.json();
    const parsed = blockCreateSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    let startAt = new Date(parsed.data.startAt);
    let endAt = new Date(parsed.data.endAt);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
      return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
    }
    const allDay = Boolean(parsed.data.allDay);
    if (allDay) {
      startAt = startOfDayIST(startAt);
      endAt = endOfDayIST(endAt);
    }
    if (endAt <= startAt) {
      return NextResponse.json({ error: "End must be after start" }, { status: 400 });
    }

    const conflicts = await findConflicts({ startAt, endAt });
    if (conflicts.appointments.length) {
      return NextResponse.json(
        {
          error: `Range overlaps ${conflicts.appointments.length} appointment(s). Move or cancel them first.`,
        },
        { status: 409 },
      );
    }

    const created = await prisma.clinicBlock.create({
      data: {
        startAt,
        endAt,
        allDay,
        reason: parsed.data.reason || null,
      },
    });
    return NextResponse.json(toBlockDTO(created));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Create failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
