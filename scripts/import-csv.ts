/**
 * Import appointments / patients / clinic closures from the old Google Sheets CSV export.
 *
 * Dates: dd-MMM-yyyy (e.g. 27-Aug-2026)
 * Times: h:mm a (e.g. 10:30 AM)
 * Timezone: Asia/Kolkata
 *
 * Usage:
 *   npm run import-csv -- --appointments ./samples/appointments.csv
 *   npm run import-csv -- --patients ./samples/patients.csv
 *   npm run import-csv -- --blocks ./samples/closures.csv
 *   npm run import-csv -- --appointments a.csv --patients p.csv --blocks b.csv
 */
import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";
import { addDays, addMinutes, istDateTime, parseSheetDate, parseSheetTime, sheetDateTime } from "../src/lib/datetime";
import { normalizePhone } from "../src/lib/phone";
import { uniqueRef, refreshPatientStats } from "../src/lib/serializers";

const prisma = new PrismaClient();

function arg(name: string) {
  const i = process.argv.indexOf(name);
  if (i === -1) return null;
  return process.argv[i + 1] ?? null;
}

function rows(file: string) {
  const raw = readFileSync(file, "utf8");
  return parse(raw, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as Record<string, string>[];
}

function col(row: Record<string, string>, ...names: string[]) {
  for (const n of names) {
    const key = Object.keys(row).find((k) => k.trim().toLowerCase() === n.toLowerCase());
    if (key && row[key] != null && String(row[key]).trim() !== "") return String(row[key]).trim();
  }
  return "";
}

async function importPatients(file: string) {
  const data = rows(file);
  let n = 0;
  for (const row of data) {
    const phone = normalizePhone(col(row, "Phone"));
    const name = col(row, "Name", "Patient Name");
    if (!phone || !name) continue;
    const email = col(row, "Email") || null;
    await prisma.patient.upsert({
      where: { phone },
      create: { phone, name, email },
      update: { name, email: email ?? undefined },
    });
    n += 1;
  }
  console.log(`Imported ${n} patients from ${file}`);
}

async function importAppointments(file: string) {
  const data = rows(file);
  let n = 0;
  for (const row of data) {
    const phone = normalizePhone(col(row, "Phone"));
    const name = col(row, "Patient Name", "Name");
    if (!phone || !name) {
      console.warn("Skipping appointment without phone/name", row);
      continue;
    }
    const email = col(row, "Email") || null;
    const patient = await prisma.patient.upsert({
      where: { phone },
      create: { phone, name, email },
      update: { name, email: email ?? undefined },
    });

    const dateStr = col(row, "Date");
    const timeStr = col(row, "Time");
    const startAt = sheetDateTime(dateStr, timeStr);
    if (!startAt) {
      console.warn("Skipping appointment with bad date/time", dateStr, timeStr);
      continue;
    }
    const durationMin = 30;
    const endAt = addMinutes(startAt, durationMin);
    const ref = col(row, "Ref") || (await uniqueRef(startAt));
    const status = (col(row, "Status") || "PENDING").toUpperCase();
    const followRaw = col(row, "FollowupDate", "Follow-up Date");
    const followupDate = followRaw ? sheetDateTime(followRaw, "10:00 AM") : null;

    await prisma.appointment.upsert({
      where: { ref },
      create: {
        ref,
        patientId: patient.id,
        service: col(row, "Service") || "Consultation",
        startAt,
        endAt,
        durationMin,
        notes: col(row, "Notes") || null,
        status,
        googleCalEventId: col(row, "CalEvent") || null,
        rxLink: col(row, "RxLink") || null,
        followupDate,
      },
      update: {
        patientId: patient.id,
        service: col(row, "Service") || "Consultation",
        startAt,
        endAt,
        notes: col(row, "Notes") || null,
        status,
        googleCalEventId: col(row, "CalEvent") || null,
        rxLink: col(row, "RxLink") || null,
        followupDate,
      },
    });
    n += 1;
  }

  const phones = new Set(
    data.map((row) => normalizePhone(col(row, "Phone"))).filter(Boolean),
  );
  for (const phone of Array.from(phones)) {
    const p = await prisma.patient.findUnique({ where: { phone } });
    if (p) await refreshPatientStats(p.id);
  }
  console.log(`Imported ${n} appointments from ${file}`);
}

async function importBlocks(file: string) {
  const data = rows(file);
  let n = 0;
  for (const row of data) {
    const fromDate = col(row, "From Date", "FromDate");
    const toDate = col(row, "To Date", "ToDate") || fromDate;
    const timeFrom = col(row, "Time From", "TimeFrom");
    const timeTo = col(row, "Time To", "TimeTo");
    const reason = col(row, "Reason") || null;
    const fd = parseSheetDate(fromDate);
    const td = parseSheetDate(toDate);
    if (!fd || !td) {
      console.warn("Skipping block with bad dates", fromDate, toDate);
      continue;
    }

    const tf = timeFrom ? parseSheetTime(timeFrom) : null;
    const tt = timeTo ? parseSheetTime(timeTo) : null;
    const allDay = !tf && !tt;

    const cursor = { y: fd.y, m: fd.m, d: fd.d };
    const last = { y: td.y, m: td.m, d: td.d };
    while (true) {
      const startAt = allDay
        ? istDateTime(cursor.y, cursor.m, cursor.d, 0, 0)
        : istDateTime(cursor.y, cursor.m, cursor.d, tf!.h, tf!.min);
      const endAt = allDay
        ? istDateTime(cursor.y, cursor.m, cursor.d, 23, 59)
        : istDateTime(cursor.y, cursor.m, cursor.d, tt?.h ?? 20, tt?.min ?? 0);

      await prisma.clinicBlock.create({
        data: { startAt, endAt, allDay, reason },
      });
      n += 1;

      if (cursor.y === last.y && cursor.m === last.m && cursor.d === last.d) break;
      const next = addDays(istDateTime(cursor.y, cursor.m, cursor.d, 12, 0), 1);
      const iso = next.toLocaleString("en-CA", { timeZone: "Asia/Kolkata" }).slice(0, 10);
      const [y, m, d] = iso.split("-").map(Number);
      cursor.y = y;
      cursor.m = m;
      cursor.d = d;
    }
  }
  console.log(`Imported ${n} closure rows from ${file}`);
}

async function main() {
  const patients = arg("--patients");
  const appointments = arg("--appointments");
  const blocks = arg("--blocks");
  if (!patients && !appointments && !blocks) {
    console.log(`Usage:
  npm run import-csv -- --appointments ./samples/appointments.csv
  npm run import-csv -- --patients ./samples/patients.csv
  npm run import-csv -- --blocks ./samples/closures.csv`);
    process.exit(1);
  }
  if (patients) await importPatients(patients);
  if (appointments) await importAppointments(appointments);
  if (blocks) await importBlocks(blocks);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
