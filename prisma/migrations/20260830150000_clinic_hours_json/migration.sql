-- Split clinic hours: ordered windows in hoursJson; hoursOpen/hoursClose stay the envelope.
ALTER TABLE "Clinic" ADD COLUMN "hoursJson" TEXT NOT NULL DEFAULT '[]';
