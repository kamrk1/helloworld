import { AsyncLocalStorage } from "node:async_hooks";

/** Request bag. Filled by getPrisma on first access inside runWithRequestPrisma. */
export type PrismaRequestBag = { client: unknown };

export const prismaAls = new AsyncLocalStorage<PrismaRequestBag>();

/** Uses als.run — workerd does not implement enterWith. */
export function runWithRequestPrisma<T>(fn: () => T): T {
  if (prismaAls.getStore()) return fn();
  return prismaAls.run({ client: null }, fn);
}
