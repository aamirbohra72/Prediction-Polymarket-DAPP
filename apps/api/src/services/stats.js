import { prisma } from "@repo/database";
import { config } from "../config.js";
import { toNumber } from "../utils/helpers.js";
import { getOrderBookSnapshot } from "./orderBook.js";

export async function getPlatformStats() {
  const [users, markets, trades, volume] = await Promise.all([
    prisma.user.count(),
    prisma.market.count(),
    prisma.trade.count(),
    prisma.trade.aggregate({ _sum: { quantity: true } }),
  ]);

  const openMarkets = await prisma.market.count({ where: { status: "OPEN" } });

  return {
    users,
    markets,
    openMarkets,
    trades,
    totalVolume: volume._sum.quantity ?? 0,
  };
}

export async function getMarketOpenInterest(marketId) {
  const positions = await prisma.position.findMany({ where: { marketId } });
  return positions.reduce((sum, p) => sum + p.yesShares + p.noShares, 0);
}

export async function getUserStats(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  const initial = config.initialBalance;
  const balance = toNumber(user.balance);

  const [tradeCount, positions, transactions] = await Promise.all([
    prisma.trade.count({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
    }),
    prisma.position.findMany({
      where: { userId, OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }] },
      include: { market: true },
    }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { createdAt: "asc" }, take: 1 }),
  ]);

  let portfolioValue = balance;
  let unrealizedPnl = 0;

  for (const pos of positions) {
    if (pos.market.status === "RESOLVED") continue;
    const book = await getOrderBookSnapshot(pos.marketId);
    const yesPrice = (book.impliedYesPrice ?? 50) / 100;
    const yesVal = pos.yesShares * yesPrice;
    const noVal = pos.noShares * (1 - yesPrice);
    portfolioValue += yesVal + noVal;
    unrealizedPnl += yesVal + noVal;
  }

  const realizedPnl = balance - initial - unrealizedPnl;
  const wins = await countResolvedWins(userId);

  return {
    balance,
    portfolioValue: Math.round(portfolioValue * 100) / 100,
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
    totalPnl: Math.round((portfolioValue - initial) * 100) / 100,
    tradeCount,
    resolvedWins: wins,
    memberSince: user.createdAt,
  };
}

async function countResolvedWins(userId) {
  const positions = await prisma.position.findMany({
    where: { userId },
    include: { market: { select: { status: true, winningOutcome: true } } },
  });
  return positions.filter(
    (p) =>
      p.market.status === "RESOLVED" &&
      p.market.winningOutcome &&
      ((p.market.winningOutcome === "YES" && p.yesShares > 0) ||
        (p.market.winningOutcome === "NO" && p.noShares > 0))
  ).length;
}
