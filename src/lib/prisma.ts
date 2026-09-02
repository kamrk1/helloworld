import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient as EdgePrismaClient } from "@prisma/client/edge";
import { HOSTED } from "./hosted-values";
import { databaseUrl } from "./db-url";

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

type ClinicPrisma = import("@prisma/client").PrismaClient;

const globalForPrisma = globalThis as unknown as {
  prisma?: ClinicPrisma;
};

const prismaAls = new AsyncLocalStorage<ClinicPrisma>();

function isCloudflareWorker() {
  return process.env["OPEN_NEXT"] === "1" || (typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers");
}

function createClient(): ClinicPrisma {
  const url = databaseUrl();
  
  if (isCloudflareWorker() || url.startsWith("prisma+postgres://") || url.startsWith("prisma://")) {
    // Cloudflare Workers strictly blocks WASM and eval. 
    // We MUST use the Edge client with a Prisma Accelerate HTTP URL.
    return new EdgePrismaClient({
      log,
      datasources: { db: { url } },
    }) as unknown as ClinicPrisma;
  }

  // Local development (SQLite) or native Node.js environments
  // Dynamically require the standard Prisma client so ESBuild doesn't bundle its WASM/Node bindings into Cloudflare
  const moduleName = "@prisma" + "/client";
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-require-imports
  const { PrismaClient } = require(moduleName);
  return new PrismaClient({
    log,
    datasources: { db: { url } },
  });
}

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return typeof value === "object" && value !== null && "then" in value && typeof (value as PromiseLike<unknown>).then === "function";
}

function releaseRequestClient(client: ClinicPrisma) {
  return client.$disconnect().catch(() => undefined);
}

function cloudflareWaitUntil(pending: Promise<unknown>) {
  const cf = (globalThis as unknown as Record<symbol, { ctx?: { waitUntil?: (p: Promise<unknown>) => void } }>)[
    Symbol.for("__cloudflare-context__")
  ];
  cf?.ctx?.waitUntil?.(pending);
}

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
