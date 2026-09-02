import { NextResponse } from "next/server";
import { prisma, withPrismaRoute } from "@/lib/prisma";
import { requireClinic } from "@/lib/require-admin";
import { invoiceSchema } from "@/lib/validation";
import { appointmentInclude, toAppointmentDTO, toInvoiceDTO } from "@/lib/serializers";

type Ctx = { params: { id: string } };

export const GET = withPrismaRoute(async function GET(_req: Request, { params }: Ctx) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const appt = await prisma.appointment.findFirst({
    where: { id: params.id, clinicId: auth.clinic.id },
    select: { id: true },
  });
  if (!appt) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const invoice = await prisma.invoice.findUnique({ where: { appointmentId: params.id } });
  if (!invoice) return NextResponse.json({ error: "No invoice yet" }, { status: 404 });
  return NextResponse.json(toInvoiceDTO(invoice));
});

export const POST = withPrismaRoute(async function POST(req: Request, { params }: Ctx) {
  const auth = await requireClinic();
  if (auth.error) return auth.error;
  const appt = await prisma.appointment.findFirst({ where: { id: params.id, clinicId: auth.clinic.id } });
  if (!appt) return NextResponse.json({ error: "Appointment not found" }, { status: 404 });

  try {
    const json = await req.json();
    const parsed = invoiceSchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
    }
    const data = parsed.data;

    // We store items as JSON string
    const itemsJson = JSON.stringify(data.items);
    // ensure date is midnight UTC or IST
    const date = new Date(`${data.date}T10:00:00+05:30`);

    const invoice = await prisma.invoice.upsert({
      where: { appointmentId: params.id },
      create: {
        clinicId: auth.clinic.id,
        appointmentId: params.id,
        billNo: data.billNo,
        date,
        amountWords: data.amountWords,
        paymentMode: data.paymentMode,
        itemsJson,
        totalAmount: data.totalAmount,
      },
      update: {
        billNo: data.billNo,
        date,
        amountWords: data.amountWords,
        paymentMode: data.paymentMode,
        itemsJson,
        totalAmount: data.totalAmount,
      },
    });

    const updated = await prisma.appointment.findUnique({
      where: { id: params.id },
      include: appointmentInclude,
    });

    if (!updated) throw new Error("Missing appt");

    return NextResponse.json({
      invoice: toInvoiceDTO(invoice),
      appointment: toAppointmentDTO(updated),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
});
