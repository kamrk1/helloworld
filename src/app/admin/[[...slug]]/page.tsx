import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { adminBase, defaultClinicId } from "@/lib/clinic-config";

export const dynamic = "force-dynamic";

export default async function AdminShim({
  params,
  searchParams,
}: {
  params: { slug?: string[] };
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const session = await getSession();
  const id = session?.role === "clinic" ? session.clinicId : defaultClinicId();
  const rest = params.slug?.length ? `/${params.slug.join("/")}` : "";
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams ?? {})) {
    if (typeof value === "string") qs.set(key, value);
    else if (Array.isArray(value) && value[0]) qs.set(key, value[0]);
  }
  const q = qs.toString();
  redirect(`${adminBase(id)}${rest}${q ? `?${q}` : ""}`);
}
