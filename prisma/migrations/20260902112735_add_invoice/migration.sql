-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "billNo" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amountWords" TEXT NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "itemsJson" TEXT NOT NULL,
    "totalAmount" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Invoice_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Invoice_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Appointment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "service" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "googleCalEventId" TEXT,
    "rxLink" TEXT,
    "followupDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Appointment_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Appointment" ("clinicId", "createdAt", "durationMin", "endAt", "followupDate", "googleCalEventId", "id", "notes", "patientId", "ref", "rxLink", "service", "startAt", "status", "updatedAt") SELECT "clinicId", "createdAt", "durationMin", "endAt", "followupDate", "googleCalEventId", "id", "notes", "patientId", "ref", "rxLink", "service", "startAt", "status", "updatedAt" FROM "Appointment";
DROP TABLE "Appointment";
ALTER TABLE "new_Appointment" RENAME TO "Appointment";
CREATE INDEX "Appointment_clinicId_startAt_idx" ON "Appointment"("clinicId", "startAt");
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");
CREATE INDEX "Appointment_endAt_idx" ON "Appointment"("endAt");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_followupDate_idx" ON "Appointment"("followupDate");
CREATE UNIQUE INDEX "Appointment_clinicId_ref_key" ON "Appointment"("clinicId", "ref");
CREATE TABLE "new_ClinicBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ClinicBlock_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ClinicBlock" ("allDay", "clinicId", "createdAt", "endAt", "id", "reason", "startAt") SELECT "allDay", "clinicId", "createdAt", "endAt", "id", "reason", "startAt" FROM "ClinicBlock";
DROP TABLE "ClinicBlock";
ALTER TABLE "new_ClinicBlock" RENAME TO "ClinicBlock";
CREATE INDEX "ClinicBlock_clinicId_startAt_endAt_idx" ON "ClinicBlock"("clinicId", "startAt", "endAt");
CREATE INDEX "ClinicBlock_startAt_endAt_idx" ON "ClinicBlock"("startAt", "endAt");
CREATE TABLE "new_Prescription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "complaints" TEXT NOT NULL,
    "findings" TEXT NOT NULL,
    "diagnosis" TEXT NOT NULL,
    "medicines" TEXT NOT NULL,
    "advice" TEXT NOT NULL,
    "followupNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Prescription_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Prescription_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Prescription" ("advice", "appointmentId", "clinicId", "complaints", "createdAt", "diagnosis", "findings", "followupNote", "id", "medicines", "updatedAt") SELECT "advice", "appointmentId", "clinicId", "complaints", "createdAt", "diagnosis", "findings", "followupNote", "id", "medicines", "updatedAt" FROM "Prescription";
DROP TABLE "Prescription";
ALTER TABLE "new_Prescription" RENAME TO "Prescription";
CREATE UNIQUE INDEX "Prescription_appointmentId_key" ON "Prescription"("appointmentId");
CREATE INDEX "Prescription_clinicId_idx" ON "Prescription"("clinicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_appointmentId_key" ON "Invoice"("appointmentId");

-- CreateIndex
CREATE INDEX "Invoice_clinicId_idx" ON "Invoice"("clinicId");
