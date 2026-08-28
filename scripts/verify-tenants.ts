/**
 * Create demo2 (if missing) and print isolation counts.
 *   DATABASE_URL="file:./clinic.db" npx tsx scripts/verify-tenants.ts
 */
import { prisma } from "../src/lib/prisma";
import { clinicPasswordDigest } from "../src/lib/auth";
import { DEFAULT_FLAGS, DEFAULT_RX, DEFAULT_SERVICES } from "../src/lib/clinic-config";
import { ensureSdcClinic } from "../src/lib/tenant";

async function main() {
  await ensureSdcClinic();
  const demo2 = await prisma.clinic.findUnique({ where: { id: "demo2" } });
  if (!demo2) {
    await prisma.clinic.create({
      data: {
        id: "demo2",
        name: "Demo Two Dental",
        shortName: "DEMO2",
        tagline: "Second tenant",
        passwordDigest: clinicPasswordDigest("demo2", "Demo2-Aug2026"),
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
    console.log("Created clinic demo2");
  } else {
    console.log("Clinic demo2 already exists");
  }

  const sdcPatients = await prisma.patient.count({ where: { clinicId: "sdc" } });
  const sdcAppts = await prisma.appointment.count({ where: { clinicId: "sdc" } });
  const d2Patients = await prisma.patient.count({ where: { clinicId: "demo2" } });
  const d2Appts = await prisma.appointment.count({ where: { clinicId: "demo2" } });
  const clinics = await prisma.clinic.findMany({ select: { id: true, name: true, hoursOpen: true, hoursClose: true, defaultDuration: true, flagsJson: true } });
  console.log(JSON.stringify({ sdcPatients, sdcAppts, d2Patients, d2Appts, clinics }, null, 2));
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
