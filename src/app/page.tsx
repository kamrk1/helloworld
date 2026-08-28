import { redirect } from "next/navigation";
import { bookingPath, defaultClinicId } from "@/lib/clinic-config";

export default function HomeRedirect() {
  redirect(bookingPath(defaultClinicId()));
}
