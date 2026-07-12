import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config.js";
import authRoutes from "./routes/auth.js";
import marketsRoutes from "./routes/markets.js";
import ordersRoutes from "./routes/orders.js";
import meRoutes from "./routes/me.js";
import adminRoutes from "./routes/admin.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import statsRoutes from "./routes/stats.js";
import streamRoutes from "./routes/stream.js";
import activityRoutes from "./routes/activity.js";
import solanaRoutes from "./routes/solana.js";
import { startScheduler } from "./services/scheduler.js";
import { connectRedis, isRedisReady, getRedisMode } from "@repo/platform/redis";
import { connectProducer, isProducerReady, isKafkaEnabled } from "@repo/kafka";
import { isEmailEnabled } from "@repo/platform/email";
import { getSolanaConfig, getSolanaHealth } from "@repo/solana";

const app = express();

app.use(
  cors({
    origin: config.webOrigin,
    credentials: true,
  })
);
app.use(express.json());

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many requests, try again later" },
});

app.get("/health", async (_req, res) => {
  const solana = await getSolanaHealth();
  res.json({
    ok: true,
    service: "prediction-api",
    redis: isRedisReady(),
    redisMode: getRedisMode(),
    kafka: isProducerReady(),
    kafkaEnabled: isKafkaEnabled(),
    email: isEmailEnabled(),
    solana: {
      enabled: getSolanaConfig().enabled,
      ok: solana.ok,
      cluster: solana.cluster,
    },
  });
});

app.use("/auth", authLimiter, authRoutes);
app.use("/markets", marketsRoutes);
app.use("/orders", ordersRoutes);
app.use("/me", meRoutes);
app.use("/admin", adminRoutes);
app.use("/leaderboard", leaderboardRoutes);
app.use("/stats", statsRoutes);
app.use("/stream", streamRoutes);
app.use("/activity", activityRoutes);
app.use("/solana", solanaRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(config.port, async () => {
  console.log(`API running on http://localhost:${config.port}`);
  await connectRedis();
  await connectProducer();
  startScheduler();
});
