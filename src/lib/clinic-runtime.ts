import type { Clinic } from "@prisma/client";
import {
  DEFAULT_BRAND,
  DEFAULT_CLINIC,
  DEFAULT_SERVICES,
  clinicLogoUrl,
  parseFlags,
  parseJsonArray,
  parseRx,
  type ClinicRuntime,
  type FeatureFlags,
} from "./clinic-config";

export type ClinicRow = Clinic;

export function toClinicRuntime(row: Clinic): ClinicRuntime {
  const durations = parseJsonArray<number>(row.durationsJson, [...DEFAULT_CLINIC.durations]).filter(
    (n) => Number.isFinite(n) && n > 0,
  );
  const services = parseJsonArray<string>(row.servicesJson, [...DEFAULT_SERVICES]).filter(Boolean);
  const closedWeekdays = parseJsonArray<number>(row.closedWeekdays, [0]).filter((n) => n >= 0 && n <= 6);
  return {
    id: row.id,
    name: row.name || DEFAULT_CLINIC.name,
    shortName: row.shortName || DEFAULT_CLINIC.shortName,
    tagline: row.tagline || DEFAULT_CLINIC.tagline,
    timezone: row.timezone || DEFAULT_CLINIC.timezone,
    hours: {
      start: row.hoursOpen || DEFAULT_CLINIC.hours.start,
      end: row.hoursClose || DEFAULT_CLINIC.hours.end,
    },
    slotMinutes: row.slotMinutes || DEFAULT_CLINIC.slotMinutes,
    defaultDuration: row.defaultDuration || DEFAULT_CLINIC.defaultDuration,
    durations: durations.length ? durations : [...DEFAULT_CLINIC.durations],
    closedWeekdays: closedWeekdays.length ? closedWeekdays : [0],
    services: services.length ? services : [...DEFAULT_SERVICES],
    phone: row.phone || "",
    address: row.address || "",
    reviewUrl: row.reviewUrl || "",
    brand: {
      primary: row.brandPrimary || DEFAULT_BRAND.primary,
      accent: row.brandAccent || DEFAULT_BRAND.accent,
    },
    flags: parseFlags(row.flagsJson),
    rx: parseRx(row.rxJson),
    enabled: row.enabled,
    hasLogo: Boolean(row.logoMime),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function toPublicClinic(runtime: ClinicRuntime) {
  return {
    id: runtime.id,
    name: runtime.name,
    shortName: runtime.shortName,
    tagline: runtime.tagline,
    timezone: runtime.timezone,
    hours: runtime.hours,
    slotMinutes: runtime.slotMinutes,
    defaultDuration: runtime.defaultDuration,
    durations: runtime.durations,
    closedWeekdays: runtime.closedWeekdays,
    services: runtime.services,
    phone: runtime.phone,
    address: runtime.address,
    brand: runtime.brand,
    flags: {
      publicBooking: runtime.flags.publicBooking,
    } as Pick<FeatureFlags, "publicBooking">,
    hasLogo: runtime.hasLogo,
    logoUrl: runtime.hasLogo ? clinicLogoUrl(runtime.id, runtime.updatedAt) : "/logo.svg",
    enabled: runtime.enabled,
  };
}

export function toAdminClinic(runtime: ClinicRuntime) {
  const pub = toPublicClinic(runtime);
  return {
    id: pub.id,
    name: pub.name,
    shortName: pub.shortName,
    tagline: pub.tagline,
    timezone: pub.timezone,
    hours: pub.hours,
    slotMinutes: pub.slotMinutes,
    defaultDuration: pub.defaultDuration,
    durations: pub.durations,
    closedWeekdays: pub.closedWeekdays,
    services: pub.services,
    phone: pub.phone,
    address: pub.address,
    brand: pub.brand,
    hasLogo: pub.hasLogo,
    logoUrl: pub.logoUrl,
    enabled: pub.enabled,
    reviewUrl: runtime.reviewUrl,
    flags: runtime.flags,
    rx: runtime.rx,
  };
}

export type PublicClinicDTO = ReturnType<typeof toPublicClinic>;
export type AdminClinicDTO = ReturnType<typeof toAdminClinic>;
