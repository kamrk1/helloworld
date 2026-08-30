import { prisma } from "./prisma";
import { databaseUrl, isPostgresUrl } from "./db-url";

/**
 * Cloudflare Workers Builds often skip `migrate deploy`. Add Clinic.hoursJson
 * and make Patient.phone nullable on first Postgres touch.
 * Never SELECT information_schema (Prisma cannot deserialize type `name`).
 * Never throw — getClinicRow/login must stay up if ALTER is a no-op.
 */
let ready: Promise<void> | null = null;

export function ensureOptionalPatientPhone() {
  return ensureClinicSchema();
}

export function ensureClinicSchema() {
  if (!isPostgresUrl(databaseUrl())) {
    return ensureSqliteHoursJson();
  }
  if (!ready) {
    ready = applyPostgresClinicSchema().catch(() => undefined);
  }
  return ready;
}

let sqliteHoursReady: Promise<void> | null = null;

function ensureSqliteHoursJson() {
  if (!sqliteHoursReady) {
    sqliteHoursReady = applySqliteHoursJson().catch(() => undefined);
  }
  return sqliteHoursReady;
}

async function applySqliteHoursJson() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Clinic" ADD COLUMN "hoursJson" TEXT NOT NULL DEFAULT '[]'`,
    );
  } catch {
    /* duplicate column */
  }
}

async function applyPostgresClinicSchema() {
  await applyOptionalPatientPhoneColumn();
  await applyHoursJsonColumn();
}

async function applyOptionalPatientPhoneColumn() {
  try {
    await prisma.$executeRawUnsafe(
      `UPDATE "Patient" SET "phone" = NULL WHERE "phone" IS NOT NULL AND btrim("phone") = ''`,
    );
  } catch {
    /* ignore */
  }
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL`);
  } catch {
    /* already nullable */
  }
}

async function applyHoursJsonColumn() {
  try {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "hoursJson" TEXT NOT NULL DEFAULT '[]'`,
    );
  } catch {
    /* already exists */
  }
}
