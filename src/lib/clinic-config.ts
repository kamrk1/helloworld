export const DEFAULT_TIMEZONE = "Asia/Kolkata";
/** Compatibility alias used by datetime helpers (IST wall clock). */
export const TIMEZONE = DEFAULT_TIMEZONE;

export const DEFAULT_CLINIC_ID = "sdc";

export const DEFAULT_SERVICES = [
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
] as const;

export const FEATURE_FLAG_KEYS = [
  "publicBooking",
  "pendingApproval",
  "followUps",
  "closures",
  "prescriptions",
  "whatsapp",
] as const;

export type FeatureFlagKey = (typeof FEATURE_FLAG_KEYS)[number];

export type FeatureFlags = Record<FeatureFlagKey, boolean>;

export const DEFAULT_FLAGS: FeatureFlags = {
  publicBooking: true,
  pendingApproval: true,
  followUps: true,
  closures: true,
  prescriptions: true,
  whatsapp: true,
};

export type RxLetterhead = {
  doctorName: string;
  qualifications: string;
  registrationNo: string;
  footer: string;
  printLogo: boolean;
  printClinic: boolean;
};

export const DEFAULT_RX: RxLetterhead = {
  doctorName: "",
  qualifications: "",
  registrationNo: "",
  footer: "",
  printLogo: true,
  printClinic: true,
};

export type ClinicBrand = {
  primary: string;
  accent: string;
};

export const DEFAULT_BRAND: ClinicBrand = {
  primary: "#0E6B6F",
  accent: "#C9A35B",
};

/** Typed defaults when a clinic row is missing a flag or field. */
export const DEFAULT_CLINIC = {
  id: DEFAULT_CLINIC_ID,
  name: "Shree Datta Dental Care",
  shortName: "SDC",
  tagline: "Gentle, modern dentistry",
  timezone: DEFAULT_TIMEZONE,
  hours: { start: "10:00", end: "20:00", windows: [{ start: "10:00", end: "20:00" }] },
  slotMinutes: 30,
  defaultDuration: 30,
  durations: [30, 60, 90] as number[],
  closedWeekdays: [0] as number[],
  services: [...DEFAULT_SERVICES] as string[],
  phone: "",
  address: "",
  reviewUrl: "",
  brand: { ...DEFAULT_BRAND },
  flags: { ...DEFAULT_FLAGS },
  rx: { ...DEFAULT_RX },
  enabled: true,
  hasLogo: false,
} as const;

export type ClinicRuntime = {
  id: string;
  name: string;
  shortName: string;
  tagline: string;
  timezone: string;
  hours: { start: string; end: string; windows: readonly { start: string; end: string }[] };
  slotMinutes: number;
  defaultDuration: number;
  durations: number[];
  closedWeekdays: number[];
  services: string[];
  phone: string;
  address: string;
  reviewUrl: string;
  brand: ClinicBrand;
  flags: FeatureFlags;
  rx: RxLetterhead;
  enabled: boolean;
  hasLogo: boolean;
  updatedAt?: string;
};

export const ACTIVE_STATUSES = ["PENDING", "APPROVED", "CONFIRMED"] as const;
export const ALL_STATUSES = [
  "PENDING",
  "APPROVED",
  "CONFIRMED",
  "REJECTED",
  "CANCELLED",
] as const;

export type AppointmentStatus = (typeof ALL_STATUSES)[number];

export function defaultClinicId() {
  return process.env["DEFAULT_CLINIC_ID"] || DEFAULT_CLINIC_ID;
}

export function parseJsonArray<T>(raw: string | null | undefined, fallback: T[]): T[] {
  if (!raw) return fallback;
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? (v as T[]) : fallback;
  } catch {
    return fallback;
  }
}

export function parseFlags(raw: string | null | undefined): FeatureFlags {
  let parsed: Partial<FeatureFlags> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    } catch {
      parsed = {};
    }
  }
  const flags = { ...DEFAULT_FLAGS };
  for (const key of FEATURE_FLAG_KEYS) {
    if (typeof parsed[key] === "boolean") flags[key] = parsed[key] as boolean;
  }
  return flags;
}

export function parseRx(raw: string | null | undefined): RxLetterhead {
  let parsed: Partial<RxLetterhead> = {};
  if (raw) {
    try {
      parsed = JSON.parse(raw) as Partial<RxLetterhead>;
    } catch {
      parsed = {};
    }
  }
  return {
    doctorName: typeof parsed.doctorName === "string" ? parsed.doctorName : DEFAULT_RX.doctorName,
    qualifications: typeof parsed.qualifications === "string" ? parsed.qualifications : DEFAULT_RX.qualifications,
    registrationNo: typeof parsed.registrationNo === "string" ? parsed.registrationNo : DEFAULT_RX.registrationNo,
    footer: typeof parsed.footer === "string" ? parsed.footer : DEFAULT_RX.footer,
    printLogo: typeof parsed.printLogo === "boolean" ? parsed.printLogo : DEFAULT_RX.printLogo,
    printClinic: typeof parsed.printClinic === "boolean" ? parsed.printClinic : DEFAULT_RX.printClinic,
  };
}

export function isValidClinicSlug(slug: string) {
  return /^[a-z0-9][a-z0-9-]{0,31}$/.test(slug);
}

export function clinicLogoUrl(clinicId: string, updatedAt?: string) {
  const q = updatedAt ? `?v=${encodeURIComponent(updatedAt)}` : "";
  return `/api/clinics/${encodeURIComponent(clinicId)}/logo${q}`;
}

export function adminBase(clinicId: string) {
  return `/c/${clinicId}/admin`;
}

export function bookingPath(clinicId: string) {
  return `/c/${clinicId}`;
}

export function clinicLoginPath(clinicId: string) {
  return `/c/${clinicId}/login`;
}

/** localStorage key for the last clinic slug typed on generic /login (one APK). */
export const LAST_CLINIC_STORAGE_KEY = "clinic-last-id";

export function platformLoginPath() {
  return "/platform/login";
}
