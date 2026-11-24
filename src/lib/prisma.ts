import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { localStore } from "./localStore";

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  prisma: any | undefined;
  hasWarnedFallback?: boolean;
};

function createClient() {
  const dbUrl = process.env.DATABASE_URL;
  let rawPrisma: PrismaClient | null = null;

  if (dbUrl && !dbUrl.includes("localhost:5432")) {
    try {
      const adapter = new PrismaPg({ connectionString: dbUrl });
      rawPrisma = new PrismaClient({
        adapter,
        log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
      });
    } catch {
      rawPrisma = null;
    }
  }

  // Resilient proxy over prisma models that seamlessly delegates to localStore if DB is offline
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler: ProxyHandler<any> = {
    get(target, propKey, receiver) {
      if (propKey in localStore) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const storeModel = (localStore as any)[propKey];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const prismaModel = rawPrisma ? (rawPrisma as any)[propKey] : null;

        return new Proxy(storeModel, {
          get(_storeTarget, methodKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return async (...args: any[]) => {
              if (prismaModel && typeof prismaModel[methodKey] === "function") {
                try {
                  return await prismaModel[methodKey](...args);
                } catch (err: unknown) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const e = err as any;
                  const msg = (e?.message || "").toLowerCase();
                  const isConnError =
                    e?.code === "ECONNREFUSED" ||
                    e?.code === "P1001" ||
                    e?.name === "PrismaClientInitializationError" ||
                    msg.includes("can't reach database") ||
                    msg.includes("connection refused") ||
                    msg.includes("prepared statement");

                  if (isConnError) {
                    if (!globalForPrisma.hasWarnedFallback) {
                      console.warn(
                        "[Storage] Database offline or unreachable. Falling back to local persistence store."
                      );
                      globalForPrisma.hasWarnedFallback = true;
                    }
                    if (typeof storeModel[methodKey] === "function") {
                      return await storeModel[methodKey](...args);
                    }
                  }
                  throw err;
                }
              }

              if (typeof storeModel[methodKey] === "function") {
                return await storeModel[methodKey](...args);
              }
              return undefined;
            };
          },
        });
      }

      if (rawPrisma) {
        return Reflect.get(rawPrisma, propKey, receiver);
      }
      return Reflect.get(target, propKey, receiver);
    },
  };

  return new Proxy(localStore, handler);
}

// Export typed as PrismaClient for TypeScript compatibility across all routes
export const prisma: PrismaClient = (globalForPrisma.prisma ?? createClient()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
