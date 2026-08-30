import { NextResponse } from "next/server";
import { getSession } from "./auth";
import { getClinicRuntime } from "./tenant";
import type { ClinicRuntime, FeatureFlagKey } from "./clinic-config";
import type { ClinicSession, PlatformSession } from "./auth";

/** Session only — no clinic row. Use when the handler will load/check the clinic itself. */
export async function requireClinicSession(): Promise<
  | { error: NextResponse; session?: undefined }
  | { error?: undefined; session: ClinicSession }
> {
  const session = await getSession();
  if (!session || session.role !== "clinic") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

export async function requireClinic(feature?: FeatureFlagKey): Promise<
  | { error: NextResponse; session?: undefined; clinic?: undefined }
  | { error?: undefined; session: ClinicSession; clinic: ClinicRuntime }
> {
  const session = await getSession();
  if (!session || session.role !== "clinic") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const clinic = await getClinicRuntime(session.clinicId);
  if (!clinic || !clinic.enabled) {
    return { error: NextResponse.json({ error: "Clinic unavailable" }, { status: 403 }) };
  }
  if (feature && !clinic.flags[feature]) {
    return { error: NextResponse.json({ error: "Not included in this clinic package" }, { status: 403 }) };
  }
  return { session, clinic };
}

export async function requirePlatform(): Promise<
  | { error: NextResponse; session?: undefined }
  | { error?: undefined; session: PlatformSession }
> {
  const session = await getSession();
  if (!session || session.role !== "platform") {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { session };
}

/** @deprecated use requireClinic */
export async function requireAdmin() {
  const result = await requireClinic();
  return result.error ?? null;
}
