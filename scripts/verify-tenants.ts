/**
 * Print isolation counts. Creates demo2 on **local SQLite only**.
 * Never mint a password digest against hosted Postgres — that hash would be
 * keyed with this process's secret, not the Worker's.
 *
 *   DATABASE_URL="file:./clinic.db" npx tsx scripts/verify-tenants.ts
 */
import { prisma } from "../src/lib/prisma";
import { clinicPasswordDigest } from "../src/lib/auth";
import { DEFAULT_FLAGS, DEFAULT_RX, DEFAULT_SERVICES } from "../src/lib/clinic-config";
import { DEMO2_CLINIC_ID, DEMO2_STAFF_PASSWORD, ensureSdcClinic } from "../src/lib/tenant";
import { isPostgresUrl } from "../src/lib/db-url";

async function main() {
  await ensureSdcClinic();
  const demo2 = await prisma.clinic.findUnique({ where: { id: DEMO2_CLINIC_ID } });
  if (!demo2) {
    if (isPostgresUrl()) {
      console.log(
        "demo2 is missing on hosted Postgres. Do not hash a password from this script.\n" +
          "Create it from /platform on the Worker, or let the Worker boot-ensure demo2 on first request.",
      );
    } else {
      await prisma.clinic.create({
        data: {
          id: DEMO2_CLINIC_ID,
          name: "Demo Two Dental",
          shortName: "DEMO2",
          tagline: "Second tenant",
          passwordDigest: clinicPasswordDigest(DEMO2_CLINIC_ID, DEMO2_STAFF_PASSWORD),
          timezone: "Asia/Kolkata",
          hoursOpen: "09:00",
          hoursClose: "17:00",
          closedWeekdays: JSON.stringify([0]),
          slotMinutes: 15,
          defaultDuration: 15,
          durationsJson: JSON.stringify([15, 30, 45]),
          servicesJson: JSON.stringify([...DEFAULT_SERVICES]),
          brandPrimary: "#0E6B6F",
          brandAccent: "#C9A35B",
          flagsJson: JSON.stringify({ ...DEFAULT_FLAGS, prescriptions: false }),
          rxJson: JSON.stringify(DEFAULT_RX),
          enabled: true,
        },
      });
      console.log("Created clinic demo2 (local SQLite digest)");
    }
  } else {
    console.log("Clinic demo2 already exists (password digest left unchanged)");
  }

  const sdcPatients = await prisma.patient.count({ where: { clinicId: "sdc" } });
  const sdcAppts = await prisma.appointment.count({ where: { clinicId: "sdc" } });
  const d2Patients = await prisma.patient.count({ where: { clinicId: DEMO2_CLINIC_ID } });
  const d2Appts = await prisma.appointment.count({ where: { clinicId: DEMO2_CLINIC_ID } });
  const clinics = await prisma.clinic.findMany({
    select: { id: true, name: true, hoursOpen: true, hoursClose: true, defaultDuration: true, flagsJson: true },
  });
  console.log(JSON.stringify({ sdcPatients, sdcAppts, d2Patients, d2Appts, clinics }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
