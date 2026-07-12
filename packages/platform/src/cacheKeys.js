import { cacheDel } from "./redis.js";

export const CACHE_KEYS = {
  leaderboard: "cache:leaderboard:v1",
  portfolioBundle: (userId) => `cache:portfolio:bundle:${userId}`,
  userStats: (userId) => `cache:user:stats:${userId}`,
};

export async function invalidateLeaderboard() {
  await cacheDel(CACHE_KEYS.leaderboard);
}

export async function invalidateUserCache(userId) {
  if (!userId) return;
  await cacheDel(CACHE_KEYS.portfolioBundle(userId), CACHE_KEYS.userStats(userId));
}

export async function invalidateAfterTrade(buyerId, sellerId) {
  await invalidateLeaderboard();
  await invalidateUserCache(buyerId);
  if (sellerId !== buyerId) await invalidateUserCache(sellerId);
}
