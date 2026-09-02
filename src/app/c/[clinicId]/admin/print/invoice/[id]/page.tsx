import { notFound, redirect } from "next/navigation";
import { prisma, runWithRequestPrisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { clinicLoginPath, clinicLogoUrl } from "@/lib/clinic-config";
import { getClinicRuntime } from "@/lib/tenant";
import { PrintTrigger } from "../../rx/[id]/PrintTrigger";
import type { InvoiceItemDTO } from "@/lib/types";

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

    // Format date as DD/MM/YYYY
    const d = new Date(inv.date);
    const dateStr = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;

    // Fill empty rows to make it look like a bill book page (e.g. 8 rows total)
    const totalRows = 8;
    const paddedItems = [...items];
    while (paddedItems.length < totalRows) {
      paddedItems.push({ name: "", cost: 0 });
    }

    const isCash = inv.paymentMode.toLowerCase().includes("cash");
    const isUpi = inv.paymentMode.toLowerCase().includes("upi");
    const isCheque = inv.paymentMode.toLowerCase().includes("cheque");
    
    // If none matched nicely (e.g. they just typed something), fallback to a blank cheque line or just put it in the line
    const showCheck = !isCash && !isUpi && inv.paymentMode ? inv.paymentMode : "";

    return (
      <div className="min-h-dvh bg-[#f9f7f1] px-4 py-8 text-[#222] font-serif print:bg-white print:p-0" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }}>
        <PrintTrigger auto={searchParams.print === "1"} clinicId={clinicId} />
        
        <div className="mx-auto max-w-[700px] bg-white print:bg-transparent shadow-sm print:shadow-none p-10 print:p-2 border border-slate-200 print:border-none">
          
          {/* Header */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-4 font-serif tracking-wide">Datta Dental Care & Implant Centre</h1>
            
            <div className="flex justify-between items-start mb-2">
              <div className="text-sm font-semibold text-left leading-snug">
                Dr. Anupam R. Singh<br/>
                <span className="text-xs font-normal">A-30006<br/>B.D.S. (Mumbai)</span>
              </div>
              <div className="flex flex-col items-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="" className="h-14 object-contain" style={{ WebkitPrintColorAdjust: "exact", printColorAdjust: "exact" }} />
              </div>
              <div className="text-sm font-semibold text-right leading-snug">
                Dr. Priya Singh<br/>
                <span className="text-xs font-normal">A-11766<br/>B.D.S. (Mumbai)</span>
              </div>
            </div>
            <div className="text-xs font-medium mt-4">Contact : 7021135010</div>
          </div>
          
          <hr className="border-t border-black mb-6" />
          
          {/* Bill No & Date */}
          <div className="flex justify-between items-center mb-4 text-[15px]">
            <div className="flex items-end">
              <span className="mr-2">Bill No.</span>
              <span className="font-bold border-b border-black px-2 pb-0.5 min-w-[100px]">{inv.billNo}</span>
            </div>
            <div className="flex items-end">
              <span className="mr-2">Date :</span>
              <span className="border-b border-black px-2 pb-0.5 min-w-[120px]">{dateStr}</span>
            </div>
          </div>
          
          {/* Patient Details */}
          <div className="flex items-end mb-4 text-[15px]">
            <span className="whitespace-nowrap mr-2">Received with thanks from Mr. / Mrs.</span>
            <span className="flex-1 border-b border-black px-2 pb-0.5">{appt.patient.name}</span>
          </div>
          
          <div className="flex items-end mb-4 text-[15px]">
            <span className="whitespace-nowrap mr-2">The sum of Rupees</span>
            <span className="flex-1 border-b border-black px-2 pb-0.5 italic text-sm">{inv.amountWords}</span>
          </div>
          
          <div className="flex items-center mb-8 text-[15px]">
            <span className="mr-3">By</span>
            <div className="flex items-center gap-1 mr-4">
              <svg className="w-4 h-4 text-black" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                {isCash && <circle cx="8" cy="8" r="4" fill="currentColor" />}
              </svg>
              <span>Cash</span>
            </div>
            <div className="flex items-center gap-1 mr-4">
              <svg className="w-4 h-4 text-black" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                {isUpi && <circle cx="8" cy="8" r="4" fill="currentColor" />}
              </svg>
              <span>UPI</span>
            </div>
            <div className="flex items-center gap-1 mr-2">
              <svg className="w-4 h-4 text-black" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
                {isCheque && <circle cx="8" cy="8" r="4" fill="currentColor" />}
              </svg>
              <span>Cheque No.</span>
            </div>
            <span className="flex-1 border-b border-black inline-block min-h-[20px] pb-0.5 px-2">{showCheck}</span>
          </div>
          
          {/* Items Table */}
          <div className="w-full">
            {paddedItems.map((item, idx) => (
              <div key={idx} className="flex justify-between items-end border-b border-black py-2.5 px-1 text-[15px]">
                <span className="flex-1">{item.name}</span>
                <div className="flex justify-between w-32 shrink-0">
                  <span className="text-gray-500 text-sm pl-2">
                    {item.name ? "₹" : ""}
                  </span>
                  <span className="font-medium text-right pr-1">
                    {item.name ? item.cost.toLocaleString() : ""}
                  </span>
                </div>
              </div>
            ))}
          </div>
          
          <div className="flex justify-end items-center mt-3 pr-1 text-[15px]">
            <span className="mr-6">Total</span>
            <span className="font-bold text-lg">₹ {inv.totalAmount.toLocaleString()}</span>
          </div>
          
          {/* Footer */}
          <div className="mt-20">
            <div className="text-right font-bold text-[15px] mb-8">Datta Dental Care & Implant Centre</div>
            <hr className="border-t border-black mb-3" />
            <div className="text-center text-xs">Shop No. 6, Shyam Residency, Sector 2A, Plot 98, Karanjade, Panvel</div>
          </div>

        </div>
      </div>
    );
  });
}
