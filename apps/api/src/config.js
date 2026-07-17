import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

export const config = {
  port: Number(process.env.API_PORT) || 4000,
  jwtSecret: process.env.JWT_SECRET || "dev-secret-change-in-production",
  adminEmail: process.env.ADMIN_EMAIL || "admin@example.com",
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
  finnhubApiKey: process.env.FINNHUB_API_KEY || "",
  initialBalance: 10000,
  mintUnfilledOrders: process.env.MINT_UNFILLED_ORDERS !== "false",
  enableScheduler: process.env.ENABLE_SCHEDULER !== "false",
  redisUrl: process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL || "",
  upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  cacheLeaderboardTtl: Number(process.env.CACHE_LEADERBOARD_TTL) || 60,
  cachePortfolioTtl: Number(process.env.CACHE_PORTFOLIO_TTL) || 30,
  redisLogErrors: process.env.REDIS_LOG_ERRORS !== "false",
  solanaEnabled: process.env.SOLANA_ENABLED === "true",
  /** Opt-in Polymarket US public catalog sync (does not replace seed markets). */
  polymarketSyncEnabled: process.env.POLYMARKET_SYNC_ENABLED === "true",
  polymarketSyncOnStart: process.env.POLYMARKET_SYNC_ON_START === "true",
  polymarketSyncLimit: Number(process.env.POLYMARKET_SYNC_LIMIT) || 40,
  polymarketKeyId: process.env.POLYMARKET_KEY_ID || "",
  polymarketSecretKey: process.env.POLYMARKET_SECRET_KEY || "",
};
