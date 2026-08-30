import { prisma } from "./prisma";
import { databaseUrl, isPostgresUrl } from "./db-url";

/**
 * Cloudflare Workers Builds often lack DATABASE_URL, so `migrate deploy` is
 * skipped. Make Patient.phone nullable and add Clinic.hoursJson on first
 * Postgres touch if missing. Idempotent; no-op when already applied.
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
    ready = applyPostgresClinicSchema().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
}

let sqliteHoursReady: Promise<void> | null = null;

function ensureSqliteHoursJson() {
  if (isPostgresUrl(databaseUrl())) return Promise.resolve();
  if (!sqliteHoursReady) {
    sqliteHoursReady = applySqliteHoursJson().catch((err) => {
      sqliteHoursReady = null;
      throw err;
    });
  }
  return sqliteHoursReady;
}

async function applySqliteHoursJson() {
  try {
    await prisma.$queryRawUnsafe(`SELECT "hoursJson" FROM "Clinic" LIMIT 1`);
  } catch {
    await prisma.$executeRawUnsafe(
      `ALTER TABLE "Clinic" ADD COLUMN "hoursJson" TEXT NOT NULL DEFAULT '[]'`,
    );
  }
}

async function applyPostgresClinicSchema() {
  await applyOptionalPatientPhone();
  await applyHoursJsonColumn();
}

async function applyOptionalPatientPhone() {
  const rows = await prisma.$queryRawUnsafe<Array<{ is_nullable: string }>>(
    `SELECT is_nullable
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'Patient'
       AND column_name = 'phone'
     LIMIT 1`,
  );
  if (rows[0]?.is_nullable !== "NO") return;
  await prisma.$executeRawUnsafe(
    `UPDATE "Patient" SET "phone" = NULL WHERE "phone" IS NOT NULL AND btrim("phone") = ''`,
  );
  await prisma.$executeRawUnsafe(`ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL`);
}

async function applyHoursJsonColumn() {
  const rows = await prisma.$queryRawUnsafe<Array<{ present: boolean }>>(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'Clinic'
         AND column_name = 'hoursJson'
     ) AS present`,
  );
  if (rows[0]?.present) return;
  await prisma.$executeRawUnsafe(
    `ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "hoursJson" TEXT NOT NULL DEFAULT '[]'`,
  );
}
