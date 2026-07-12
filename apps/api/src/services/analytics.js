import { prisma } from "@repo/database";
import { config } from "../config.js";
import { toNumber } from "../utils/helpers.js";
import { getOrderBookSnapshot } from "./orderBook.js";

export async function getUserAnalytics(userId) {
  const [transactions, positions, trades, resolvedPositions] = await Promise.all([
    prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true, balanceAfter: true, type: true },
    }),
    prisma.position.findMany({
      where: {
        userId,
        OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
      },
      include: { market: true },
    }),
    prisma.trade.findMany({
      where: { OR: [{ buyerId: userId }, { sellerId: userId }] },
      select: { marketId: true, quantity: true },
    }),
    prisma.position.findMany({
      where: { userId },
      include: { market: { select: { status: true, winningOutcome: true } } },
    }),
  ]);

  const balanceHistory = transactions.map((t) => ({
    at: t.createdAt,
    balance: Math.round(toNumber(t.balanceAfter) * 100) / 100,
    type: t.type,
  }));

  const exposureBySymbol = {};
  for (const pos of positions) {
    if (pos.market.status === "RESOLVED") continue;
    const book = await getOrderBookSnapshot(pos.marketId);
    const yesP = (book.impliedYesPrice ?? 50) / 100;
    const value =
      Math.round((pos.yesShares * yesP + pos.noShares * (1 - yesP)) * 100) / 100;
    const sym = pos.market.symbol;
    exposureBySymbol[sym] = (exposureBySymbol[sym] || 0) + value;
  }

  const exposure = Object.entries(exposureBySymbol)
    .map(([symbol, value]) => ({ symbol, value }))
    .sort((a, b) => b.value - a.value);

  const marketIds = new Set(trades.map((t) => t.marketId));
  const avgTradeSize =
    trades.length > 0
      ? Math.round(
          (trades.reduce((s, t) => s + t.quantity, 0) / trades.length) * 10
        ) / 10
      : 0;

  const resolved = resolvedPositions.filter((p) => p.market.status === "RESOLVED");
  const wins = resolved.filter(
    (p) =>
      p.market.winningOutcome &&
      ((p.market.winningOutcome === "YES" && p.yesShares > 0) ||
        (p.market.winningOutcome === "NO" && p.noShares > 0))
  ).length;

  return {
    balanceHistory,
    exposure,
    marketsTraded: marketIds.size,
    tradeCount: trades.length,
    avgTradeSize,
    resolvedMarkets: resolved.length,
    winRate: resolved.length > 0 ? Math.round((wins / resolved.length) * 100) : null,
    initialBalance: config.initialBalance,
  };
}
