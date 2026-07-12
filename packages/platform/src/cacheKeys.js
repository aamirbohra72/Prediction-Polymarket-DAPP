import { cacheDel } from "./redis.js";

export const CACHE_KEYS = {
  leaderboard: "cache:leaderboard:v1",
  portfolioBundle: (userId) => `cache:portfolio:bundle:${userId}`,
  userStats: (userId) => `cache:user:stats:${userId}`,
  marketsList: (key) => `cache:markets:list:${key}`,
};

export async function invalidateLeaderboard() {
  await cacheDel(CACHE_KEYS.leaderboard);
}

export async function invalidateUserCache(userId) {
  if (!userId) return;
  await cacheDel(CACHE_KEYS.portfolioBundle(userId), CACHE_KEYS.userStats(userId));
}

export async function invalidateMarketsList() {
  await cacheDel(
    CACHE_KEYS.marketsList("default"),
    CACHE_KEYS.marketsList("OPEN"),
    CACHE_KEYS.marketsList("CLOSED"),
    CACHE_KEYS.marketsList("RESOLVED"),
    CACHE_KEYS.marketsList("STOCK"),
    CACHE_KEYS.marketsList("SPORTS"),
    CACHE_KEYS.marketsList("volume"),
    CACHE_KEYS.marketsList("yesPrice"),
    CACHE_KEYS.marketsList("resolveDate")
  );
}

export async function invalidateAfterTrade(buyerId, sellerId) {
  await invalidateLeaderboard();
  await invalidateMarketsList();
  await invalidateUserCache(buyerId);
  if (sellerId !== buyerId) await invalidateUserCache(sellerId);
}
