import { prisma } from "@repo/database";

export async function recordPriceSnapshot(marketId, yesPriceCents) {
  const volume = await prisma.trade.aggregate({
    where: { marketId },
    _sum: { quantity: true },
  });

  await prisma.priceSnapshot.create({
    data: {
      marketId,
      yesPriceCents: Math.min(99, Math.max(1, yesPriceCents)),
      volume: volume._sum.quantity ?? 0,
    },
  });
}

export async function getPriceHistory(marketId, limit = 100) {
  const snapshots = await prisma.priceSnapshot.findMany({
    where: { marketId },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  if (snapshots.length >= 2) {
    return snapshots.map((s) => ({
      yesPriceCents: s.yesPriceCents,
      volume: s.volume,
      at: s.createdAt,
    }));
  }

  const trades = await prisma.trade.findMany({
    where: { marketId, outcome: "YES" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  return trades.map((t) => ({
    yesPriceCents: t.priceCents,
    volume: t.quantity,
    at: t.createdAt,
  }));
}
