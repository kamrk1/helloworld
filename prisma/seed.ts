import { prisma } from "../src/lib/prisma";
import { DEFAULT_CLINIC, defaultClinicId } from "../src/lib/clinic-config";
import { ensureSdcClinic } from "../src/lib/tenant";
import { addDays, addMinutes, getISTParts, istDateTime, startOfWeekMondayIST } from "../src/lib/datetime";

type SeedPatient = {
  phone: string;
  name: string;
  email?: string;
};

type SeedAppt = {
  phone: string;
  service: string;
  dayOffset: number;
  hour: number;
  minute: number;
  durationMin: number;
  status: string;
  notes?: string;
  followupDayOffset?: number | null;
  ref?: string;
};

function arg(name: string) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

async function main() {
  await ensureSdcClinic();
  const clinicId = (arg("--clinic") || process.env["SEED_CLINIC_ID"] || defaultClinicId()).toLowerCase();
  const existing = await prisma.patient.count({ where: { clinicId } });
  if (existing > 0) {
    console.log(`Clinic ${clinicId} already has ${existing} patients — skipping seed.`);
    return;
  }

  const clinic = await prisma.clinic.findUnique({ where: { id: clinicId } });
  if (!clinic) {
    throw new Error(`Clinic ${clinicId} does not exist. Create it from /platform first.`);
  }

  const monday = startOfWeekMondayIST();
  const mp = getISTParts(monday);

  const patients: SeedPatient[] = [
    { phone: "9876500001", name: "Priya Sharma", email: "priya.sharma@example.com" },
    { phone: "9876500002", name: "Rahul Patil", email: "rahul.patil@example.com" },
    { phone: "9876500003", name: "Anjali Deshmukh", email: "anjali.d@example.com" },
    { phone: "9876500004", name: "Vikram Joshi" },
    { phone: "9876500005", name: "Meera Kulkarni", email: "meera.k@example.com" },
    { phone: "9876500006", name: "Arjun Nair", email: "arjun.nair@example.com" },
    { phone: "9876500007", name: "Sneha Iyer" },
    { phone: "9876500008", name: "Farhan Khan", email: "farhan.k@example.com" },
    { phone: "9876500009", name: "Kavita Reddy" },
    { phone: "9876500010", name: "Nikhil Rao", email: "nikhil.rao@example.com" },
    { phone: "9876500011", name: "Pooja Singh" },
    { phone: "9876500012", name: "Amit Verma", email: "amit.verma@example.com" },
    { phone: "9876500013", name: "Neha Kulkarni" },
    { phone: "9876500014", name: "Sanjay Pawar" },
    { phone: "9876500015", name: "Divya Menon", email: "divya.menon@example.com" },
  ];

  const created = new Map<string, { id: string }>();
  for (const p of patients) {
    const row = await prisma.patient.create({
      data: { clinicId, phone: p.phone, name: p.name, email: p.email ?? null },
    });
    created.set(p.phone, row);
  }

  const appts: SeedAppt[] = [
    { phone: "9876500001", service: "Consultation", dayOffset: 0, hour: 10, minute: 0, durationMin: 30, status: "CONFIRMED", notes: "First visit, tooth sensitivity" },
    { phone: "9876500002", service: "Cleaning / Scaling", dayOffset: 0, hour: 11, minute: 0, durationMin: 60, status: "APPROVED" },
    { phone: "9876500003", service: "Tooth Filling", dayOffset: 0, hour: 15, minute: 0, durationMin: 60, status: "CONFIRMED" },
    { phone: "9876500004", service: "Follow-up Visit", dayOffset: 1, hour: 10, minute: 30, durationMin: 30, status: "APPROVED", followupDayOffset: 8 },
    { phone: "9876500005", service: "Root Canal", dayOffset: 1, hour: 12, minute: 0, durationMin: 90, status: "CONFIRMED", notes: "UR6 RCT sitting 2" },
    { phone: "9876500006", service: "Extraction", dayOffset: 1, hour: 16, minute: 0, durationMin: 60, status: "APPROVED" },
    { phone: "9876500007", service: "Kids Dentistry", dayOffset: 1, hour: 17, minute: 30, durationMin: 30, status: "PENDING", notes: "Online booking" },
    { phone: "9876500008", service: "Whitening", dayOffset: 2, hour: 10, minute: 0, durationMin: 90, status: "APPROVED" },
    { phone: "9876500009", service: "Crown / Bridge", dayOffset: 2, hour: 14, minute: 30, durationMin: 60, status: "CONFIRMED" },
    { phone: "9876500010", service: "Consultation", dayOffset: 2, hour: 18, minute: 0, durationMin: 30, status: "PENDING", notes: "Pain on chewing" },
    { phone: "9876500011", service: "X-ray / OPG", dayOffset: 3, hour: 10, minute: 0, durationMin: 30, status: "APPROVED" },
    { phone: "9876500012", service: "Braces Consult", dayOffset: 3, hour: 11, minute: 30, durationMin: 30, status: "CONFIRMED" },
    { phone: "9876500001", service: "Tooth Filling", dayOffset: 3, hour: 15, minute: 0, durationMin: 60, status: "APPROVED" },
    { phone: "9876500013", service: "Emergency", dayOffset: 3, hour: 18, minute: 30, durationMin: 30, status: "PENDING", notes: "Broken filling" },
    { phone: "9876500014", service: "Denture", dayOffset: 4, hour: 10, minute: 30, durationMin: 60, status: "APPROVED" },
    { phone: "9876500015", service: "Cleaning / Scaling", dayOffset: 4, hour: 12, minute: 30, durationMin: 60, status: "CONFIRMED" },
    { phone: "9876500003", service: "Follow-up Visit", dayOffset: 4, hour: 17, minute: 0, durationMin: 30, status: "APPROVED", followupDayOffset: 4 },
    { phone: "9876500006", service: "Consultation", dayOffset: 5, hour: 11, minute: 0, durationMin: 30, status: "APPROVED" },
    { phone: "9876500008", service: "Root Canal", dayOffset: 5, hour: 12, minute: 0, durationMin: 90, status: "CONFIRMED" },
    { phone: "9876500002", service: "Follow-up Visit", dayOffset: -4, hour: 11, minute: 0, durationMin: 30, status: "CONFIRMED", followupDayOffset: -1, notes: "Review after scaling" },
    { phone: "9876500005", service: "Root Canal", dayOffset: -7, hour: 14, minute: 0, durationMin: 90, status: "CONFIRMED", followupDayOffset: 1 },
    { phone: "9876500009", service: "Consultation", dayOffset: -10, hour: 10, minute: 0, durationMin: 30, status: "CANCELLED", notes: "Patient cancelled" },
  ];

  const prefix = clinicId.replace(/[^a-z0-9]/gi, "").slice(0, 8).toUpperCase() || "CLN";
  let i = 0;
  for (const a of appts) {
    const patient = created.get(a.phone)!;
    const startAt = addDays(
      istDateTime(mp.year, mp.month, mp.day, a.hour, a.minute),
      a.dayOffset,
    );
    const endAt = addMinutes(startAt, a.durationMin);
    const sp = getISTParts(startAt);
    const ref = `${prefix}-${sp.year}${String(sp.month).padStart(2, "0")}${String(sp.day).padStart(2, "0")}-${String(100 + i).slice(-3)}`;
    i += 1;
    const followupDate =
      a.followupDayOffset == null
        ? null
        : addDays(istDateTime(mp.year, mp.month, mp.day, 10, 0), a.followupDayOffset);

    await prisma.appointment.create({
      data: {
        clinicId,
        ref,
        patientId: patient.id,
        service: a.service,
        startAt,
        endAt,
        durationMin: a.durationMin,
        status: a.status,
        notes: a.notes ?? null,
        followupDate,
        googleCalEventId: a.status === "CONFIRMED" ? `stub-cal-${ref}` : null,
      },
    });
  }

  await prisma.clinicBlock.createMany({
    data: [
      {
        clinicId,
        startAt: addDays(istDateTime(mp.year, mp.month, mp.day, 13, 0), 2),
        endAt: addDays(istDateTime(mp.year, mp.month, mp.day, 14, 0), 2),
        allDay: false,
        reason: "Lunch / staff break",
      },
      {
        clinicId,
        startAt: addDays(istDateTime(mp.year, mp.month, mp.day, 16, 0), 4),
        endAt: addDays(istDateTime(mp.year, mp.month, mp.day, 17, 0), 4),
        allDay: false,
        reason: "Lab pickup window",
      },
    ],
  });

  for (const p of Array.from(created.values())) {
    const rows = await prisma.appointment.findMany({
      where: { clinicId, patientId: p.id, status: { in: ["PENDING", "APPROVED", "CONFIRMED"] } },
      orderBy: { startAt: "asc" },
    });
    await prisma.patient.update({
      where: { id: p.id },
      data: {
        totalBookings: rows.length,
        firstVisit: rows[0]?.startAt ?? null,
        lastVisit: rows[rows.length - 1]?.startAt ?? null,
        concerns: Array.from(new Set(rows.map((r) => r.service))).join(", ") || null,
      },
    });
  }

  console.log(
    `Seeded ${patients.length} patients, ${appts.length} appointments, 2 closures for clinic ${clinicId} week of ${mp.year}-${String(mp.month).padStart(2, "0")}-${String(mp.day).padStart(2, "0")} (${DEFAULT_CLINIC.timezone}).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
