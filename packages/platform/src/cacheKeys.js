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
  const statuses = ["all", "OPEN", "CLOSED", "RESOLVED"];
  const categories = [
    "all",
    "STOCK",
    "COMMODITIES",
    "INDICES",
    "CRYPTO",
    "FOREX",
    "SPORTS",
  ];
  const timeframes = ["all", "daily", "weekly", "monthly"];
  const sorts = ["default", "volume", "yesPrice", "resolveDate"];
  const keys = [];
  for (const status of statuses) {
    for (const category of categories) {
      for (const timeframe of timeframes) {
        for (const sort of sorts) {
          keys.push(
            CACHE_KEYS.marketsList(`${status}:${category}:${timeframe}:${sort}`)
          );
          // Older 3-segment keys
          keys.push(CACHE_KEYS.marketsList(`${status}:${category}:${sort}`));
        }
      }
    }
  }
  keys.push(
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
  await cacheDel(...keys);
}

export async function invalidateAfterTrade(buyerId, sellerId) {
  await invalidateLeaderboard();
  await invalidateMarketsList();
  await invalidateUserCache(buyerId);
  if (sellerId !== buyerId) await invalidateUserCache(sellerId);
}
