/**
 * Dump the connected database (cloud in production, SQLite locally) to backups/.
 * Optional disaster-recovery file. The live clinic DB is the hosted Postgres URL.
 *
 *   npm run backup
 */
import { mkdirSync, writeFileSync } from "fs";
import path from "path";
import { prisma } from "../src/lib/prisma";
import { databaseUrl, isPostgresUrl } from "../src/lib/db-url";

async function main() {
  const payload = {
    savedAt: new Date().toISOString(),
    source: isPostgresUrl() ? "postgres" : "sqlite",
    database: isPostgresUrl() ? "cloud" : databaseUrl(),
    clinics: await prisma.clinic.findMany({
      select: {
        id: true,
        name: true,
        shortName: true,
        enabled: true,
        hoursOpen: true,
        hoursClose: true,
        hoursJson: true,
        flagsJson: true,
      },
    }),
    patients: await prisma.patient.findMany(),
    appointments: await prisma.appointment.findMany(),
    prescriptions: await prisma.prescription.findMany(),
    blocks: await prisma.clinicBlock.findMany(),
  };

  const dir = path.join(process.cwd(), "backups");
  mkdirSync(dir, { recursive: true });
  const stamp = payload.savedAt.replace(/[:.]/g, "-");
  const file = path.join(dir, `clinic-${stamp}.json`);
  writeFileSync(file, JSON.stringify(payload, null, 2));
  console.log(
    `Wrote ${file} (${payload.patients.length} patients, ${payload.appointments.length} appointments, ${payload.blocks.length} blocks).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
