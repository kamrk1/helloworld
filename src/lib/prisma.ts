import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { HOSTED } from "./hosted-values";
import { databaseUrl, isPostgresUrl } from "./db-url";

function applyHosted(key: keyof typeof HOSTED) {
  const value = HOSTED[key];
  if (value && !process.env[key]) process.env[key] = value;
}
applyHosted("DATABASE_URL");
applyHosted("ADMIN_PASSWORD");
applyHosted("SESSION_SECRET");
applyHosted("PLATFORM_PASSWORD");
applyHosted("CLINIC_PASSWORD_PEPPER");

if (!process.env["DATABASE_URL"]) {
  process.env["DATABASE_URL"] = "file:./clinic.db";
}

const log: ("error" | "warn")[] =
  process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"];

type ClinicPrisma = PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: ClinicPrisma;
};

function isCloudflareWorker() {
  // OPEN_NEXT=1 is also set during the Node OpenNext build — do not use it here.
  return typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";
}

function createPgAdapterClient(url: string): ClinicPrisma {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    idleTimeoutMillis: 5_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter, log } as ConstructorParameters<typeof PrismaClient>[0]);
}

function createClient(): ClinicPrisma {
  const url = databaseUrl();
  if (isPostgresUrl(url)) {
    return createPgAdapterClient(url);
  }
  return new PrismaClient({
    log,
    datasources: { db: { url } },
  });
}

/**
 * workerd: new Pool per getPrisma() (one prisma.x access). Slow if many queries,
 * but connects. Never isolate-lifetime Pool, enterWith, next/headers, or React cache.
 * Node/SQLite: process singleton.
 */
export function getPrisma(): ClinicPrisma {
  if (isCloudflareWorker()) {
    return createClient();
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient();
  }
  return globalForPrisma.prisma;
}

export const prisma: ClinicPrisma = new Proxy({} as ClinicPrisma, {
  get(_target, prop) {
    const client = getPrisma() as unknown as Record<PropertyKey, unknown>;
    const value = client[prop];
    return typeof value === "function" ? value.bind(client) : value;
  },
});
