import { notFound } from "next/navigation";
import { PublicBooking } from "@/components/booking/PublicBooking";
import { requireEnabledClinic } from "@/lib/tenant";
import { runWithRequestPrisma } from "@/lib/prisma";
import { toPublicClinic } from "@/lib/clinic-runtime";
import { isValidClinicSlug } from "@/lib/clinic-config";

export const dynamic = "force-dynamic";

export default async function ClinicBookingPage({ params }: { params: { clinicId: string } }) {
  return runWithRequestPrisma(async () => {
    const id = params.clinicId.toLowerCase();
    if (!isValidClinicSlug(id)) notFound();
    const clinic = await requireEnabledClinic(id);
    if (!clinic) notFound();
    if (!clinic.flags.publicBooking) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-ivory px-4">
          <p className="max-w-md text-center text-slate-600">Online booking is not enabled for this clinic.</p>
        </div>
      );
    }
    return <PublicBooking clinic={toPublicClinic(clinic)} />;
  });
}
