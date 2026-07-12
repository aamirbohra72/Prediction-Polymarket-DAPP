import { prisma } from "@repo/database";
import { toNumber } from "../utils/helpers.js";
import { config } from "../config.js";
import { cacheGet, cacheSet } from "@repo/platform/redis";
import { CACHE_KEYS } from "./cacheKeys.js";

export async function computeLeaderboard() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      balance: true,
      createdAt: true,
      _count: {
        select: {
          buyTrades: true,
          sellTrades: true,
        },
      },
    },
    orderBy: { balance: "desc" },
    take: 50,
  });

  const positions = await prisma.position.findMany({
    where: {
      OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
    },
    include: {
      market: { select: { status: true, winningOutcome: true } },
    },
  });

  const winsByUser = new Map();
  for (const p of positions) {
    if (p.market.status !== "RESOLVED" || !p.market.winningOutcome) continue;
    const won =
      (p.market.winningOutcome === "YES" && p.yesShares > 0) ||
      (p.market.winningOutcome === "NO" && p.noShares > 0);
    if (won) winsByUser.set(p.userId, (winsByUser.get(p.userId) || 0) + 1);
  }

  return {
    leaderboard: users.map((u, i) => ({
      rank: i + 1,
      email: u.email.replace(/(.{2}).+(@.+)/, "$1***$2"),
      balance: toNumber(u.balance),
      tradeCount: u._count.buyTrades + u._count.sellTrades,
      resolvedWins: winsByUser.get(u.id) || 0,
    })),
    cachedAt: Date.now(),
  };
}

export async function getLeaderboardCached() {
  const key = CACHE_KEYS.leaderboard;
  const cached = await cacheGet(key);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const data = await computeLeaderboard();
  await cacheSet(key, data, config.cacheLeaderboardTtl);
  return { ...data, fromCache: false };
}
