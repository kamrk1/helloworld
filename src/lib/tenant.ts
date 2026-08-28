import { prisma } from "./prisma";
import { clinicPasswordDigest } from "./auth";
import {
  DEFAULT_CLINIC,
  DEFAULT_FLAGS,
  DEFAULT_RX,
  DEFAULT_SERVICES,
  defaultClinicId,
  isValidClinicSlug,
} from "./clinic-config";
import { toClinicRuntime } from "./clinic-runtime";
import type { ClinicRuntime, FeatureFlags } from "./clinic-config";

const sdcServices = JSON.stringify([...DEFAULT_SERVICES]);

function envContact() {
  return {
    phone: process.env["NEXT_PUBLIC_CLINIC_PHONE"] || "",
    address: process.env["NEXT_PUBLIC_CLINIC_ADDRESS"] || "",
    reviewUrl: process.env["NEXT_PUBLIC_REVIEW_URL"] || "",
  };
}

export async function ensureSdcClinic() {
  const id = defaultClinicId();
  const existing = await prisma.clinic.findUnique({ where: { id } });
  const envPassword = process.env["ADMIN_PASSWORD"] || "changeme";
  const contact = envContact();
  if (!existing) {
    await prisma.clinic.create({
      data: {
        id,
        name: DEFAULT_CLINIC.name,
        shortName: DEFAULT_CLINIC.shortName,
        tagline: DEFAULT_CLINIC.tagline,
        passwordDigest: clinicPasswordDigest(id, envPassword),
        timezone: DEFAULT_CLINIC.timezone,
        hoursOpen: DEFAULT_CLINIC.hours.start,
        hoursClose: DEFAULT_CLINIC.hours.end,
        closedWeekdays: JSON.stringify([...DEFAULT_CLINIC.closedWeekdays]),
        slotMinutes: DEFAULT_CLINIC.slotMinutes,
        defaultDuration: DEFAULT_CLINIC.defaultDuration,
        durationsJson: JSON.stringify([...DEFAULT_CLINIC.durations]),
        servicesJson: sdcServices,
        phone: contact.phone,
        address: contact.address,
        reviewUrl: contact.reviewUrl,
        brandPrimary: DEFAULT_CLINIC.brand.primary,
        brandAccent: DEFAULT_CLINIC.brand.accent,
        flagsJson: JSON.stringify(DEFAULT_FLAGS),
        rxJson: JSON.stringify(DEFAULT_RX),
        enabled: true,
      },
    });
    return;
  }
  const patch: {
    passwordDigest?: string;
    phone?: string;
    address?: string;
    reviewUrl?: string;
    flagsJson?: string;
  } = {};
  if (!existing.passwordDigest && envPassword) {
    patch.passwordDigest = clinicPasswordDigest(id, envPassword);
  }
  if (!existing.phone && contact.phone) patch.phone = contact.phone;
  if (!existing.address && contact.address) patch.address = contact.address;
  if (!existing.reviewUrl && contact.reviewUrl) patch.reviewUrl = contact.reviewUrl;
  if (!existing.flagsJson || existing.flagsJson === "{}") {
    patch.flagsJson = JSON.stringify(DEFAULT_FLAGS);
  }
  if (Object.keys(patch).length) {
    await prisma.clinic.update({ where: { id }, data: patch });
  }
}

export async function getClinicRow(id: string) {
  await ensureSdcClinic();
  if (!isValidClinicSlug(id)) return null;
  return prisma.clinic.findUnique({ where: { id } });
}

export async function getClinicRuntime(id: string): Promise<ClinicRuntime | null> {
  const row = await getClinicRow(id);
  if (!row) return null;
  return toClinicRuntime(row);
}

export async function requireEnabledClinic(id: string) {
  const runtime = await getClinicRuntime(id);
  if (!runtime || !runtime.enabled) return null;
  return runtime;
}

export function flagsOrDefault(flags?: FeatureFlags): FeatureFlags {
  return { ...DEFAULT_FLAGS, ...flags };
}
