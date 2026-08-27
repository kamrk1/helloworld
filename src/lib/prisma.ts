import { PrismaClient as SqlitePrisma } from "@prisma/client";
import { PrismaClient as CloudPrisma } from "@/generated/cloud";
import { HOSTED } from "./hosted-values";
import { databaseUrl, isPostgresUrl } from "./db-url";

function applyHosted(key: keyof typeof HOSTED) {
  const value = HOSTED[key];
  if (value && !process.env[key]) process.env[key] = value;
}
applyHosted("DATABASE_URL");
applyHosted("ADMIN_PASSWORD");
applyHosted("SESSION_SECRET");

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:./clinic.db";
}

const log: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

type ClinicPrisma = SqlitePrisma;

const globalForPrisma = globalThis as unknown as { prisma?: ClinicPrisma };

function createClient(): ClinicPrisma {
  const url = databaseUrl();
  if (isPostgresUrl(url)) {
    return new CloudPrisma({
      log,
      datasources: { db: { url } },
    }) as unknown as ClinicPrisma;
  }
  return new SqlitePrisma({
    log,
    datasources: { db: { url } },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
