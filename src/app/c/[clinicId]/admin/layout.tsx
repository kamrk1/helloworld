import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { ToastProvider } from "@/components/admin/Toast";
import { AdminDataProvider } from "@/components/admin/AdminDataProvider";
import { AdminShell } from "@/components/admin/AdminShell";
import { clinicLoginPath, isValidClinicSlug } from "@/lib/clinic-config";
import { requireEnabledClinic } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function ClinicAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { clinicId: string };
}) {
  const clinicId = params.clinicId.toLowerCase();
  if (!isValidClinicSlug(clinicId)) redirect("/login");
  const clinic = await requireEnabledClinic(clinicId);
  if (!clinic) redirect("/login");

  const session = await getSession();
  if (!session || session.role !== "clinic") {
    redirect(clinicLoginPath(clinicId));
  }
  if (session.clinicId !== clinicId) {
    redirect(clinicLoginPath(clinicId));
  }

  return (
    <ToastProvider>
      <AdminDataProvider clinicId={clinicId}>
        <AdminShell>{children}</AdminShell>
      </AdminDataProvider>
    </ToastProvider>
  );
}
