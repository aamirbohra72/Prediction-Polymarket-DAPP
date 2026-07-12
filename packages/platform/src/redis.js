import Redis from "ioredis";
import { Redis as UpstashRedis } from "@upstash/redis";
import { env } from "./env.js";

let ioredisClient = null;
let upstashClient = null;
let ready = false;
let mode = "none";

function initUpstashRest() {
  if (!env.upstashRestUrl || !env.upstashRestToken) return null;
  upstashClient = new UpstashRedis({
    url: env.upstashRestUrl,
    token: env.upstashRestToken,
  });
  mode = "upstash-rest";
  ready = true;
  console.log("[redis] Using Upstash REST (HTTPS) — stockpredict-cache");
  return upstashClient;
}

function initIoRedis() {
  if (!env.redisUrl) return null;
  const useTls = env.redisUrl.startsWith("rediss://");
  ioredisClient = new Redis(env.redisUrl, {
    maxRetriesPerRequest: 2,
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 10000,
    ...(useTls ? { tls: {} } : {}),
  });

  ioredisClient.on("error", () => {
    ready = false;
  });

  ioredisClient.on("ready", () => {
    ready = true;
    mode = "ioredis";
    console.log("[redis] Connected via TCP (ioredis)");
  });

  return ioredisClient;
}

export async function connectRedis() {
  if (env.upstashRestUrl && env.upstashRestToken) {
    initUpstashRest();
    try {
      await upstashClient.ping();
      return true;
    } catch (err) {
      ready = false;
      mode = "none";
      console.warn("[redis] Upstash REST failed:", err.message);
    }
  }

  const redis = initIoRedis();
  if (!redis) return false;

  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.ping();
    ready = true;
    return true;
  } catch (err) {
    ready = false;
    console.warn("[redis] TCP unavailable:", err.message);
    return false;
  }
}

export function isRedisReady() {
  if (mode === "upstash-rest") return ready && upstashClient != null;
  return ready && ioredisClient?.status === "ready";
}

export function getRedisMode() {
  return mode;
}

export async function cacheGet(key) {
  if (!isRedisReady()) return null;
  try {
    if (mode === "upstash-rest") {
      const raw = await upstashClient.get(key);
      if (raw == null) return null;
      return typeof raw === "string" ? JSON.parse(raw) : raw;
    }
    const raw = await ioredisClient.get(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  if (!isRedisReady()) return false;
  try {
    const payload = JSON.stringify(value);
    if (mode === "upstash-rest") {
      if (ttlSeconds > 0) await upstashClient.set(key, payload, { ex: ttlSeconds });
      else await upstashClient.set(key, payload);
      return true;
    }
    if (ttlSeconds > 0) await ioredisClient.setex(key, ttlSeconds, payload);
    else await ioredisClient.set(key, payload);
    return true;
  } catch {
    return false;
  }
}

export async function cacheDel(...keys) {
  if (!isRedisReady() || keys.length === 0) return;
  try {
    if (mode === "upstash-rest") await upstashClient.del(...keys);
    else await ioredisClient.del(...keys);
  } catch {
    /* ignore */
  }
}
