import { notFound } from "next/navigation";
import ClinicLoginForm from "@/components/auth/ClinicLoginForm";
import { requireEnabledClinic } from "@/lib/tenant";
import { isValidClinicSlug, clinicLogoUrl } from "@/lib/clinic-config";

export const dynamic = "force-dynamic";

export default async function ClinicLoginPage({ params }: { params: { clinicId: string } }) {
  const id = params.clinicId.toLowerCase();
  if (!isValidClinicSlug(id)) notFound();
  const clinic = await requireEnabledClinic(id);
  if (!clinic) notFound();
  return (
    <ClinicLoginForm
      clinicId={clinic.id}
      clinicName={clinic.name}
      logoUrl={clinic.hasLogo ? clinicLogoUrl(clinic.id, clinic.updatedAt) : "/logo.svg"}
    />
  );
}
