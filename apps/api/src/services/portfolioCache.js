import { prisma } from "@repo/database";
import { config } from "../config.js";
import { formatUser, formatMarket, toNumber } from "../utils/helpers.js";
import { getUserStats } from "./stats.js";
import { getOrderBookSnapshot } from "./orderBook.js";
import { cacheGet, cacheSet } from "@repo/platform/redis";
import { CACHE_KEYS } from "./cacheKeys.js";

async function computePositions(userId) {
  const positions = await prisma.position.findMany({
    where: {
      userId,
      OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
    },
    include: { market: true },
  });

  return Promise.all(
    positions.map(async (p) => {
      let markValue = 0;
      if (p.market.status !== "RESOLVED") {
        const book = await getOrderBookSnapshot(p.marketId);
        const yesP = (book.impliedYesPrice ?? 50) / 100;
        markValue = p.yesShares * yesP + p.noShares * (1 - yesP);
      }
      return {
        id: p.id,
        market: formatMarket(p.market),
        yesShares: p.yesShares,
        noShares: p.noShares,
        markValue: Math.round(markValue * 100) / 100,
      };
    })
  );
}

async function computeTransactions(userId) {
  const transactions = await prisma.transaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return transactions.map((t) => ({
    id: t.id,
    type: t.type,
    amount: toNumber(t.amount),
    balanceAfter: toNumber(t.balanceAfter),
    marketId: t.marketId,
    note: t.note,
    createdAt: t.createdAt,
  }));
}

export async function getUserStatsCached(userId) {
  const key = CACHE_KEYS.userStats(userId);
  const cached = await cacheGet(key);
  if (cached) return { stats: cached, fromCache: true };

  const stats = await getUserStats(userId);
  await cacheSet(key, stats, config.cachePortfolioTtl);
  return { stats, fromCache: false };
}

export async function getPortfolioBundleCached(user) {
  const key = CACHE_KEYS.portfolioBundle(user.id);
  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const [statsResult, positions, transactions] = await Promise.all([
    getUserStatsCached(user.id),
    computePositions(user.id),
    computeTransactions(user.id),
  ]);

  const bundle = {
    user: formatUser(user),
    stats: statsResult.stats,
    positions,
    transactions,
    cachedAt: Date.now(),
  };

  await cacheSet(key, bundle, config.cachePortfolioTtl);
  return { ...bundle, fromCache: false };
}
