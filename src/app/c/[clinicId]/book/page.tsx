import { redirect } from "next/navigation";
import { bookingPath } from "@/lib/clinic-config";

export default function BookAlias({ params }: { params: { clinicId: string } }) {
  redirect(bookingPath(params.clinicId.toLowerCase()));
}
