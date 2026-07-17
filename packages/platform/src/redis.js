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
  if (!redis) {
    console.warn("[redis] No Redis configured — using in-memory cache fallback");
    return false;
  }

  try {
    if (redis.status !== "ready") await redis.connect();
    await redis.ping();
    ready = true;
    return true;
  } catch (err) {
    ready = false;
    console.warn("[redis] TCP unavailable:", err.message, "— using in-memory cache fallback");
    return false;
  }
}

export function isRedisReady() {
  if (mode === "upstash-rest") return ready && upstashClient != null;
  return ready && ioredisClient?.status === "ready";
}

/**
 * In-memory fallback so caching still works when Redis is unavailable
 * (e.g. Upstash DB deleted, TCP blocked). Single-process only — for
 * multi-instance production you still want a shared Redis, but this keeps
 * the app fast and degrades gracefully instead of hitting the DB every time.
 */
const memStore = new Map(); // key -> { value, expiresAt }
const MEM_MAX_KEYS = 1000;

function memGet(key) {
  const entry = memStore.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memStore.delete(key);
    return null;
  }
  return entry.value;
}

function memSet(key, value, ttlSeconds) {
  if (memStore.size >= MEM_MAX_KEYS) {
    const now = Date.now();
    for (const [k, v] of memStore) {
      if (v.expiresAt && v.expiresAt < now) memStore.delete(k);
    }
    if (memStore.size >= MEM_MAX_KEYS) {
      memStore.delete(memStore.keys().next().value);
    }
  }
  memStore.set(key, {
    value,
    expiresAt: ttlSeconds > 0 ? Date.now() + ttlSeconds * 1000 : 0,
  });
}

export function getRedisMode() {
  return mode;
}

export async function cacheGet(key) {
  if (!isRedisReady()) return memGet(key);
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
    return memGet(key);
  }
}

export async function cacheSet(key, value, ttlSeconds) {
  if (!isRedisReady()) {
    memSet(key, value, ttlSeconds);
    return true;
  }
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
    memSet(key, value, ttlSeconds);
    return true;
  }
}

export async function cacheDel(...keys) {
  if (keys.length === 0) return;
  for (const k of keys) memStore.delete(k);
  if (!isRedisReady()) return;
  try {
    if (mode === "upstash-rest") await upstashClient.del(...keys);
    else await ioredisClient.del(...keys);
  } catch {
    /* ignore */
  }
}
