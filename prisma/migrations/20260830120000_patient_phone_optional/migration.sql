-- Redefine Patient so phone can be NULL (walk-ins without a mobile).
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Patient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "clinicId" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "firstVisit" DATETIME,
    "lastVisit" DATETIME,
    "totalBookings" INTEGER NOT NULL DEFAULT 0,
    "concerns" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Patient_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Patient" (
    "id", "clinicId", "phone", "name", "email", "firstVisit", "lastVisit",
    "totalBookings", "concerns", "createdAt", "updatedAt"
)
SELECT
    "id",
    "clinicId",
    CASE WHEN "phone" = '' THEN NULL ELSE "phone" END,
    "name",
    "email",
    "firstVisit",
    "lastVisit",
    "totalBookings",
    "concerns",
    "createdAt",
    "updatedAt"
FROM "Patient";
DROP TABLE "Patient";
ALTER TABLE "new_Patient" RENAME TO "Patient";
CREATE UNIQUE INDEX "Patient_clinicId_phone_key" ON "Patient"("clinicId", "phone");
CREATE INDEX "Patient_clinicId_idx" ON "Patient"("clinicId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
