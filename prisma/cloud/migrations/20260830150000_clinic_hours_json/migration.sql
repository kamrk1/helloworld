-- Split clinic hours: ordered windows in hoursJson; hoursOpen/hoursClose stay the envelope.
ALTER TABLE "Clinic" ADD COLUMN IF NOT EXISTS "hoursJson" TEXT NOT NULL DEFAULT '[]';
