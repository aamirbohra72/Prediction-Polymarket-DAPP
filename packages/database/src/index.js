import { PrismaClient } from "./generated/client/index.js";

const globalForPrisma = globalThis;

function neonFriendlyUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    const isNeon =
      u.hostname.includes("neon.tech") || u.hostname.includes("pooler");
    if (!isNeon) return url;

    // Prisma + Neon pooler (PgBouncer transaction mode)
    if (!u.searchParams.has("pgbouncer")) u.searchParams.set("pgbouncer", "true");
    if (!u.searchParams.has("connection_limit")) u.searchParams.set("connection_limit", "5");
    if (!u.searchParams.has("connect_timeout")) u.searchParams.set("connect_timeout", "15");
    if (!u.searchParams.has("pool_timeout")) u.searchParams.set("pool_timeout", "15");
    // Avoid idle drops looking like hard failures
    if (!u.searchParams.has("socket_timeout")) u.searchParams.set("socket_timeout", "30");

    // channel_binding=require often breaks Prisma ↔ Neon pooler
    if (u.searchParams.get("channel_binding") === "require") {
      u.searchParams.delete("channel_binding");
    }

    if (!u.searchParams.has("sslmode")) u.searchParams.set("sslmode", "require");

    return u.toString();
  } catch {
    return url;
  }
}

function isTransientConnectionError(err) {
  const msg = String(err?.message || err || "");
  return (
    err?.code === "P1017" ||
    err?.code === "P1001" ||
    err?.code === "P1002" ||
    /Server has closed the connection/i.test(msg) ||
    /Can't reach database server/i.test(msg) ||
    /Connection reset/i.test(msg) ||
    /ECONNRESET/i.test(msg) ||
    /Connection terminated/i.test(msg) ||
    /prepared statement .* does not exist/i.test(msg)
  );
}

const datasourceUrl = neonFriendlyUrl(process.env.DATABASE_URL);

function createClient() {
  const base = new PrismaClient({
    datasources: datasourceUrl ? { db: { url: datasourceUrl } } : undefined,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

  // Auto-retry once after Neon/pooler drops an idle connection
  return base.$extends({
    query: {
      async $allOperations({ args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!isTransientConnectionError(err)) throw err;
          console.warn("[prisma] transient DB disconnect — reconnecting…", err.message);
          try {
            await base.$disconnect();
          } catch {
            /* ignore */
          }
          await base.$connect();
          return query(args);
        }
      },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "./generated/client/index.js";
