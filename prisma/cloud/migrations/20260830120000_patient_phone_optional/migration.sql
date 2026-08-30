-- Staff walk-ins may have no mobile. Store missing numbers as NULL so
-- clinicId+phone uniqueness does not collide (Postgres allows multiple NULLs).
UPDATE "Patient" SET "phone" = NULL WHERE "phone" IS NOT NULL AND btrim("phone") = '';
ALTER TABLE "Patient" ALTER COLUMN "phone" DROP NOT NULL;
