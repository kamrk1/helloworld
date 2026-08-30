import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { HOSTED } from "./hosted-values";
import { defaultClinicId } from "./clinic-config";

function applyHosted(key: "ADMIN_PASSWORD" | "SESSION_SECRET" | "PLATFORM_PASSWORD" | "CLINIC_PASSWORD_PEPPER") {
  const value = HOSTED[key as keyof typeof HOSTED];
  if (value && !process.env[key]) process.env[key] = value;
}
applyHosted("ADMIN_PASSWORD");
applyHosted("SESSION_SECRET");
applyHosted("PLATFORM_PASSWORD");
applyHosted("CLINIC_PASSWORD_PEPPER");

const COOKIE = "sdc_session";
const MAX_AGE = 60 * 60 * 24 * 7;
const SESSION_VERSION = 2;

function sessionSecret() {
  const secret = process.env["SESSION_SECRET"];
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(payload: string) {
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

export type ClinicSession = { role: "clinic"; clinicId: string; exp: number };
export type PlatformSession = { role: "platform"; exp: number };
export type Session = ClinicSession | PlatformSession;

function verify(token: string): Session | null {
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      v: number;
      exp: number;
      role?: string;
      clinicId?: string;
    };
    if (data.v !== SESSION_VERSION || data.exp < Date.now()) return null;
    if (data.role === "platform") return { role: "platform", exp: data.exp };
    if (data.role === "clinic" && data.clinicId) {
      return { role: "clinic", clinicId: data.clinicId, exp: data.exp };
    }
    return null;
  } catch {
    return null;
  }
}

function tokenFor(body: Record<string, unknown>) {
  const payload = Buffer.from(
    JSON.stringify({ v: SESSION_VERSION, exp: Date.now() + MAX_AGE * 1000, ...body }),
  ).toString("base64url");
  return sign(payload);
}

export function createClinicSessionToken(clinicId: string) {
  return tokenFor({ role: "clinic", clinicId });
}

export function createPlatformSessionToken() {
  return tokenFor({ role: "platform" });
}

export async function getSession(): Promise<Session | null> {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  try {
    return verify(token);
  } catch {
    return null;
  }
}

export function sessionCookie(token: string) {
  return {
    name: COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  };
}

export function clearSessionCookie() {
  return {
    name: COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}

/**
 * HMAC key for staff password digests. Prefer CLINIC_PASSWORD_PEPPER (same
 * wrangler secret on every host that mints or checks a digest). Falls back to
 * SESSION_SECRET so existing sdc rows keep working.
 */
function passwordPepper() {
  return process.env["CLINIC_PASSWORD_PEPPER"] || sessionSecret();
}

function clinicHmac(clinicId: string, password: string, secret: string) {
  return createHmac("sha256", secret).update(`clinic:${clinicId}:v1:${password}`).digest("base64url");
}

/** Mint a digest in this process only — never copy a hash from another host. */
export function clinicPasswordDigest(clinicId: string, password: string) {
  return clinicHmac(clinicId, password, passwordPepper());
}

function safeEqualString(provided: string, expected: string) {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) {
    const dummy = Buffer.alloc(b.length);
    timingSafeEqual(dummy, b);
    return false;
  }
  return timingSafeEqual(a, b);
}

export function checkClinicPassword(clinicId: string, password: string, storedDigest: string) {
  if (storedDigest) {
    const keys = [passwordPepper(), sessionSecret()];
    const seen = new Set<string>();
    for (const key of keys) {
      if (seen.has(key)) continue;
      seen.add(key);
      if (safeEqualString(clinicHmac(clinicId, password, key), storedDigest)) return true;
    }
    return false;
  }
  // One-time migration: sdc still uses env ADMIN_PASSWORD until hashed onto the row.
  if (clinicId === defaultClinicId()) {
    const expected = process.env["ADMIN_PASSWORD"];
    if (!expected) return false;
    return safeEqualString(password, expected);
  }
  return false;
}

export function platformPassword() {
  return process.env["PLATFORM_PASSWORD"] || "platform-demo";
}

export function checkPlatformPassword(password: string) {
  return safeEqualString(password, platformPassword());
}
