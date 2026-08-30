-- CreateTable
CREATE TABLE IF NOT EXISTS "Clinic" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL DEFAULT '',
    "tagline" TEXT NOT NULL DEFAULT '',
    "passwordDigest" TEXT NOT NULL DEFAULT '',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "hoursOpen" TEXT NOT NULL DEFAULT '10:00',
    "hoursClose" TEXT NOT NULL DEFAULT '20:00',
    "closedWeekdays" TEXT NOT NULL DEFAULT '[0]',
    "slotMinutes" INTEGER NOT NULL DEFAULT 30,
    "defaultDuration" INTEGER NOT NULL DEFAULT 30,
    "durationsJson" TEXT NOT NULL DEFAULT '[30,60,90]',
    "servicesJson" TEXT NOT NULL DEFAULT '[]',
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "reviewUrl" TEXT NOT NULL DEFAULT '',
    "brandPrimary" TEXT NOT NULL DEFAULT '#0E6B6F',
    "brandAccent" TEXT NOT NULL DEFAULT '#C9A35B',
    "logoBytes" BYTEA,
    "logoMime" TEXT,
    "rxJson" TEXT NOT NULL DEFAULT '{}',
    "flagsJson" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Clinic_pkey" PRIMARY KEY ("id")
);

INSERT INTO "Clinic" (
  "id", "name", "shortName", "tagline", "passwordDigest", "timezone",
  "hoursOpen", "hoursClose", "closedWeekdays", "slotMinutes", "defaultDuration",
  "durationsJson", "servicesJson", "brandPrimary", "brandAccent", "enabled", "updatedAt"
) VALUES (
  'sdc',
  'Shree Datta Dental Care',
  'SDC',
  'Gentle, modern dentistry',
  '',
  'Asia/Kolkata',
  '10:00',
  '20:00',
  '[0]',
  30,
  30,
  '[30,60,90]',
  '["Consultation","Cleaning / Scaling","Tooth Filling","Root Canal","Extraction","Crown / Bridge","Whitening","Braces Consult","Denture","Kids Dentistry","X-ray / OPG","Follow-up Visit","Emergency"]',
  '#0E6B6F',
  '#C9A35B',
  true,
  CURRENT_TIMESTAMP
) ON CONFLICT ("id") DO NOTHING;

ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "Prescription" ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "ClinicBlock" ADD COLUMN IF NOT EXISTS "clinicId" TEXT NOT NULL DEFAULT 'sdc';

ALTER TABLE "Patient" DROP CONSTRAINT IF EXISTS "Patient_phone_key";
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_ref_key";
DROP INDEX IF EXISTS "Patient_phone_key";
DROP INDEX IF EXISTS "Appointment_ref_key";

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_clinicId_phone_key" ON "Patient"("clinicId", "phone");
CREATE INDEX IF NOT EXISTS "Patient_clinicId_idx" ON "Patient"("clinicId");
CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_clinicId_ref_key" ON "Appointment"("clinicId", "ref");
CREATE INDEX IF NOT EXISTS "Appointment_clinicId_startAt_idx" ON "Appointment"("clinicId", "startAt");
CREATE INDEX IF NOT EXISTS "Prescription_clinicId_idx" ON "Prescription"("clinicId");
CREATE INDEX IF NOT EXISTS "ClinicBlock_clinicId_startAt_endAt_idx" ON "ClinicBlock"("clinicId", "startAt", "endAt");

DO $$ BEGIN
  ALTER TABLE "Patient" ADD CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "Prescription" ADD CONSTRAINT "Prescription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$ BEGIN
  ALTER TABLE "ClinicBlock" ADD CONSTRAINT "ClinicBlock_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
