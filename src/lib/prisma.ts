import { AsyncLocalStorage } from "node:async_hooks";
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

/**
 * Request scope. workerd implements AsyncLocalStorage.run / getStore,
 * not enterWith (that 500'd the live Worker).
 */
const prismaAls = new AsyncLocalStorage<ClinicPrisma>();

function isCloudflareWorker() {
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

/** One Pool for this callback (and every prisma.x inside it). Never enterWith. */
export function runWithRequestPrisma<T>(fn: () => T): T {
  if (prismaAls.getStore()) return fn();
  if (isCloudflareWorker()) {
    return prismaAls.run(createClient(), fn);
  }
  return fn();
}

export function withPrismaRoute<A extends unknown[], R>(handler: (...args: A) => R): (...args: A) => R {
  return (...args: A) => runWithRequestPrisma(() => handler(...args));
}

export function getPrisma(): ClinicPrisma {
  const scoped = prismaAls.getStore();
  if (scoped) return scoped;
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
