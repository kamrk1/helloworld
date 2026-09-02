import { notFound, redirect } from "next/navigation";
import { prisma, runWithRequestPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { clinicLoginPath, clinicLogoUrl } from "@/lib/clinic-config";
import { getClinicRuntime } from "@/lib/tenant";
import { PrintTrigger } from "../../rx/[id]/PrintTrigger";
import type { InvoiceItemDTO } from "@/lib/types";
import { formatDateLong } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function PrintInvoicePage({
  params,
  searchParams,
}: {
  params: { clinicId: string; id: string };
  searchParams: { print?: string };
}) {
  return runWithRequestPrisma(async () => {
    const clinicId = params.clinicId.toLowerCase();
    const session = await getSession();
    if (!session || session.role !== "clinic" || session.clinicId !== clinicId) {
      redirect(clinicLoginPath(clinicId));
    }
    const clinic = await getClinicRuntime(clinicId);
    if (!clinic) notFound();

    const appt = await prisma.appointment.findFirst({
      where: { id: params.id, clinicId },
      include: { patient: true, invoice: true },
    });
    if (!appt || !appt.invoice) notFound();
    const inv = appt.invoice;
    const items = JSON.parse(inv.itemsJson || "[]") as InvoiceItemDTO[];
    const logoSrc = clinic.hasLogo ? clinicLogoUrl(clinic.id, clinic.updatedAt) : "/logo.svg";

    return (
      <div className="min-h-dvh bg-[#ffffe6] px-6 py-8 text-slate-900 font-sans print:bg-white">
        <PrintTrigger auto={searchParams.print === "1"} clinicId={clinicId} />
        <div className="mx-auto max-w-[720px] bg-transparent">
          
          <div className="flex justify-between items-center mb-6">
            <div className="text-sm font-semibold leading-snug">
              Dr. Anupam R. Singh<br/>
              <span className="text-xs">A-30006<br/>B.D.S. (Mumbai)</span>
            </div>
            <div className="flex flex-col items-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="" className="h-16 object-contain mb-1" />
              <div className="text-[10px] font-bold">Contact : {clinic.phone}</div>
            </div>
            <div className="text-sm font-semibold text-right leading-snug">
              Dr. Priya Singh<br/>
              <span className="text-xs">A-11766<br/>B.D.S. (Mumbai)</span>
            </div>
          </div>
          
          <div className="border-t-2 border-b-2 border-slate-800 py-1 text-center font-display text-xl font-bold uppercase tracking-wide">
            {clinic.name}
          </div>
          
          <div className="mt-4 flex justify-between items-center font-medium">
            <div className="text-lg">Bill No. <span className="font-bold ml-2">{inv.billNo}</span></div>
            <div className="text-lg">Date : <span className="font-bold ml-2">{formatDateLong(new Date(inv.date))}</span></div>
          </div>
          
          <div className="mt-6 text-lg leading-loose font-medium">
            <div className="flex items-end">
              <span className="whitespace-nowrap mr-2">Received with thanks from Mr. / Mrs.</span>
              <span className="flex-1 border-b border-black font-semibold px-2">{appt.patient.name}</span>
            </div>
            
            <div className="flex items-end mt-2">
              <span className="whitespace-nowrap mr-2">The sum of Rupees</span>
              <span className="flex-1 border-b border-black font-semibold px-2">{inv.amountWords}</span>
            </div>
            
            <div className="flex items-end mt-2">
              <span className="whitespace-nowrap mr-2">By Cash / UPI / Cheque No.</span>
              <span className="flex-1 border-b border-black font-semibold px-2">{inv.paymentMode}</span>
            </div>
          </div>
          
          <div className="mt-8 border-t-2 border-b-2 border-black">
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between border-b border-dashed border-slate-400 py-3 px-2">
                <span className="font-medium">{item.name}</span>
                <span className="font-bold">₹{item.cost.toLocaleString()}</span>
              </div>
            ))}
          </div>
          
          <div className="flex justify-between items-center py-3 px-2">
            <span className="font-bold text-xl uppercase tracking-wider">Total</span>
            <span className="font-bold text-xl border-b-[3px] border-black pb-1">₹{inv.totalAmount.toLocaleString()}</span>
          </div>
          
          <div className="mt-16 text-center">
            <div className="text-xs font-semibold mb-1">॥श्री॥</div>
            <div className="font-bold text-lg">{clinic.name}</div>
            <div className="text-sm font-medium mt-1">{clinic.address}</div>
          </div>

        </div>
      </div>
    );
  });
}
