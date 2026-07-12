import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

export const env = {
  redisUrl: process.env.REDIS_URL || "",
  upstashRestUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRestToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  cacheLeaderboardTtl: Number(process.env.CACHE_LEADERBOARD_TTL) || 60,
  cachePortfolioTtl: Number(process.env.CACHE_PORTFOLIO_TTL) || 30,
  redisLogErrors: process.env.REDIS_LOG_ERRORS !== "false",
  webOrigin: process.env.WEB_ORIGIN || "http://localhost:3000",
  appName: process.env.APP_NAME || "StockPredict",
  emailNotificationsEnabled: process.env.EMAIL_NOTIFICATIONS_ENABLED !== "false",
  brevoApiKey: process.env.BREVO_API_KEY || "",
  brevoSenderEmail: process.env.BREVO_SENDER_EMAIL || "",
  brevoSenderName: process.env.BREVO_SENDER_NAME || "StockPredict",
};
