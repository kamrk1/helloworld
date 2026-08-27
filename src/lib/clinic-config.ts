export const TIMEZONE = "Asia/Kolkata";

export const CLINIC = {
  name: "Shree Datta Dental Care",
  shortName: "SDC",
  tagline: "Gentle, modern dentistry",
  timezone: TIMEZONE,
  hours: { start: "10:00", end: "20:00" } as const,
  slotMinutes: 30,
  /** JS weekday: 0 = Sunday */
  closedWeekdays: [0] as number[],
  durations: [30, 60, 90] as const,
  defaultDuration: 30,
  services: [
    "Consultation",
    "Cleaning / Scaling",
    "Tooth Filling",
    "Root Canal",
    "Extraction",
    "Crown / Bridge",
    "Whitening",
    "Braces Consult",
    "Denture",
    "Kids Dentistry",
    "X-ray / OPG",
    "Follow-up Visit",
    "Emergency",
  ] as const,
} as const;

export const ACTIVE_STATUSES = ["PENDING", "APPROVED", "CONFIRMED"] as const;
export const ALL_STATUSES = [
  "PENDING",
  "APPROVED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
] as const;

export type AppointmentStatus = (typeof ALL_STATUSES)[number];
