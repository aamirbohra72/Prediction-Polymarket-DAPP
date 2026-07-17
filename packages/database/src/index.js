import { PrismaClient } from "./generated/client/index.js";

const globalForPrisma = globalThis;

function neonFriendlyUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Neon pooler (PgBouncer) needs these Prisma query params
    if (u.hostname.includes("neon.tech") || u.hostname.includes("pooler")) {
      if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
      if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
      if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
      if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "15");
    }
    return u.toString();
  } catch {
    return url;
  }
}

const datasourceUrl = neonFriendlyUrl(process.env.DATABASE_URL);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/client/index.js";
