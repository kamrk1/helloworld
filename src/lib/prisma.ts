import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
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

const prismaAls = new AsyncLocalStorage<ClinicPrisma>();

function isWorkerdRuntime() {
  return (
    (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers") ||
    process.env["OPEN_NEXT"] === "1"
  );
}

function createPgAdapterClient(url: string): ClinicPrisma {
  const pool = new Pool({
    connectionString: url,
    max: 1,
    // Request-scoped: do not hold TCP across Worker requests.
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
 * One Pool for this request (shared across prisma.x access), not for the isolate.
 * A process-lifetime pg Pool on workerd cannot keep TCP/TLS and times out (~8s).
 */
function requestScopedClient(): ClinicPrisma {
  const existing = prismaAls.getStore();
  if (existing) return existing;
  const client = createClient();
  prismaAls.enterWith(client);
  return client;
}

const getPrismaForRequest =
  typeof cache === "function" ? cache(requestScopedClient) : requestScopedClient;

export function getPrisma(): ClinicPrisma {
  const url = databaseUrl();
  if (isPostgresUrl(url) && isWorkerdRuntime()) {
    return getPrismaForRequest();
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
