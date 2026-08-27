import type { AppointmentStatus } from "./clinic-config";

export const STATUS_LABEL: Record<AppointmentStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  CONFIRMED: "Confirmed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export function statusClass(status: AppointmentStatus) {
  switch (status) {
    case "PENDING":
      return "bg-gold-light text-gold-dark";
    case "APPROVED":
      return "bg-teal-light text-teal-dark";
    case "CONFIRMED":
      return "bg-teal text-white";
    case "REJECTED":
      return "bg-red-50 text-red-700";
    case "CANCELLED":
      return "bg-slate-100 text-slate-500";
  }
}
