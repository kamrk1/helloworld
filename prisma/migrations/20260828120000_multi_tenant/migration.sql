-- CreateTable
CREATE TABLE "Clinic" (
    "id" TEXT NOT NULL PRIMARY KEY,
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
    "servicesJson" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "reviewUrl" TEXT NOT NULL DEFAULT '',
    "brandPrimary" TEXT NOT NULL DEFAULT '#0E6B6F',
    "brandAccent" TEXT NOT NULL DEFAULT '#C9A35B',
    "logoBytes" BLOB,
    "logoMime" TEXT,
    "rxJson" TEXT NOT NULL DEFAULT '{}',
    "flagsJson" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "Clinic" (
  "id", "name", "shortName", "tagline", "passwordDigest", "timezone",
  "hoursOpen", "hoursClose", "closedWeekdays", "slotMinutes", "defaultDuration",
  "durationsJson", "servicesJson", "phone", "address", "reviewUrl",
  "brandPrimary", "brandAccent", "rxJson", "flagsJson", "enabled",
  "createdAt", "updatedAt"
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
  '',
  '',
  '',
  '#0E6B6F',
  '#C9A35B',
  '{}',
  '{}',
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
);

ALTER TABLE "Patient" ADD COLUMN "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "Appointment" ADD COLUMN "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "Prescription" ADD COLUMN "clinicId" TEXT NOT NULL DEFAULT 'sdc';
ALTER TABLE "ClinicBlock" ADD COLUMN "clinicId" TEXT NOT NULL DEFAULT 'sdc';

DROP INDEX IF EXISTS "Patient_phone_key";
DROP INDEX IF EXISTS "Appointment_ref_key";

CREATE UNIQUE INDEX "Patient_clinicId_phone_key" ON "Patient"("clinicId", "phone");
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");
CREATE UNIQUE INDEX "Appointment_clinicId_ref_key" ON "Appointment"("clinicId", "ref");
CREATE INDEX "Appointment_clinicId_startAt_idx" ON "Appointment"("clinicId", "startAt");
CREATE INDEX "Prescription_clinicId_idx" ON "Prescription"("clinicId");
CREATE INDEX "ClinicBlock_clinicId_startAt_endAt_idx" ON "ClinicBlock"("clinicId", "startAt", "endAt");
