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
const requestPools = new WeakMap<ClinicPrisma, Pool>();

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
  const client = new PrismaClient({ adapter, log } as ConstructorParameters<typeof PrismaClient>[0]);
  requestPools.set(client, pool);
  return client;
}

function createClient(): ClinicPrisma {
  const url = databaseUrl();
  if (url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    // Accelerate uses HTTP fetch, perfectly safe for Cloudflare Workers
    return new PrismaClient({
      log,
      datasources: { db: { url } },
    } as ConstructorParameters<typeof PrismaClient>[0]);
  }
  if (isPostgresUrl(url)) {
    // Raw Postgres URLs use adapter-pg (crashes with eval on CF, requires Accelerate instead)
    return createPgAdapterClient(url);
  }
  return new PrismaClient({
    log,
    datasources: { db: { url } },
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof (value as PromiseLike<unknown>).then === "function";
}

function releaseRequestClient(client: ClinicPrisma) {
  const pool = requestPools.get(client);
  requestPools.delete(client);
  return Promise.all([
    pool ? pool.end().catch(() => undefined) : Promise.resolve(),
    client.$disconnect().catch(() => undefined),
  ]);
}

function cloudflareWaitUntil(pending: Promise<unknown>) {
  const cf = (globalThis as unknown as Record<symbol, { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }>)[
    Symbol.for("__cloudflare-context__")
  ];
  cf?.ctx?.waitUntil?.(pending);
}

/** One Pool for this callback (and every prisma.x inside it). Never enterWith.
 *  Close the Pool after the handler settles so the next request can connect (Prisma Postgres connection cap). */
export function runWithRequestPrisma<T>(fn: () => T): T {
  if (prismaAls.getStore()) return fn();
  if (isCloudflareWorker()) {
    const client = createClient();
    let settle!: () => void;
    const finished = new Promise<void>((resolve) => {
      settle = resolve;
    });
    cloudflareWaitUntil(finished.then(() => releaseRequestClient(client)));
    try {
      const result = prismaAls.run(client, fn);
      if (isPromiseLike(result)) {
        const done = Promise.resolve(result);
        void done.then(settle, settle);
        return done as T;
      }
      settle();
      return result;
    } catch (err) {
      settle();
      throw err;
    }
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
