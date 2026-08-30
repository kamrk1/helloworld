import { prisma } from "./prisma";
import { databaseUrl, isPostgresUrl } from "./db-url";

/**
 * Cloudflare Workers Builds often lack DATABASE_URL, so `migrate deploy` is
 * skipped. Make Patient.phone nullable on first Postgres touch if the column
 * is still NOT NULL. Idempotent; no-op on SQLite.
 */
let ready: Promise<void> | null = null;

export function ensureOptionalPatientPhone() {
  if (!isPostgresUrl(databaseUrl())) return Promise.resolve();
  if (!ready) {
    ready = applyOptionalPatientPhone().catch((err) => {
      ready = null;
      throw err;
    });
  }
  return ready;
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
