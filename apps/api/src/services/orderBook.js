import { prisma } from "@repo/database";

function aggregateLevels(orders) {
  const map = new Map();
  for (const o of orders) {
    const rem = o.quantity - o.filledQty;
    if (rem <= 0) continue;
    map.set(o.priceCents, (map.get(o.priceCents) || 0) + rem);
  }
  return [...map.entries()]
    .map(([priceCents, quantity]) => ({ priceCents, quantity }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

export async function getOrderBookSnapshot(marketId) {
  const openOrders = await prisma.order.findMany({
    where: { marketId, status: "OPEN" },
    orderBy: { createdAt: "desc" },
  });

  const yesBids = openOrders.filter((o) => o.outcome === "YES" && o.side === "BUY");
  const yesAsks = openOrders.filter((o) => o.outcome === "YES" && o.side === "SELL");
  const noBids = openOrders.filter((o) => o.outcome === "NO" && o.side === "BUY");
  const noAsks = openOrders.filter((o) => o.outcome === "NO" && o.side === "SELL");

  const bestYesBid = yesBids.length ? Math.max(...yesBids.map((o) => o.priceCents)) : null;
  const bestYesAsk = yesAsks.length ? Math.min(...yesAsks.map((o) => o.priceCents)) : null;
  const bestNoBid = noBids.length ? Math.max(...noBids.map((o) => o.priceCents)) : null;
  const bestNoAsk = noAsks.length ? Math.min(...noAsks.map((o) => o.priceCents)) : null;

  const trades = await prisma.trade.findMany({
    where: { marketId },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const volume = await prisma.trade.aggregate({
    where: { marketId },
    _sum: { quantity: true },
  });
  const totalVolume = volume._sum.quantity ?? 0;
  const lastTrade = trades[0];

  let impliedYesPrice =
    bestYesAsk != null && bestYesBid != null
      ? Math.round((bestYesAsk + bestYesBid) / 2)
      : bestYesAsk ?? bestYesBid ?? null;

  if (impliedYesPrice == null && lastTrade?.outcome === "YES") {
    impliedYesPrice = lastTrade.priceCents;
  }
  if (impliedYesPrice == null) impliedYesPrice = 50;

  const spread =
    bestYesAsk != null && bestYesBid != null ? bestYesAsk - bestYesBid : null;

  return {
    bestYesBid,
    bestYesAsk,
    bestNoBid,
    bestNoAsk,
    spread,
    impliedYesPrice,
    volume: totalVolume,
    recentTrades: trades.map((t) => ({
      id: t.id,
      outcome: t.outcome,
      priceCents: t.priceCents,
      quantity: t.quantity,
      createdAt: t.createdAt,
    })),
    depth: {
      yesBids: aggregateLevels(yesBids).sort((a, b) => b.priceCents - a.priceCents),
      yesAsks: aggregateLevels(yesAsks),
      noBids: aggregateLevels(noBids).sort((a, b) => b.priceCents - a.priceCents),
      noAsks: aggregateLevels(noAsks),
    },
    openOrders: openOrders
      .filter((o) => o.quantity - o.filledQty > 0)
      .slice(0, 40)
      .map((o) => ({
        id: o.id,
        outcome: o.outcome,
        side: o.side,
        priceCents: o.priceCents,
        quantity: o.quantity - o.filledQty,
        createdAt: o.createdAt,
      })),
  };
}

/** Price to cross the book for immediate execution (market order). */
export function getMarketExecutionPrice(book, outcome, side) {
  if (outcome === "YES") {
    return side === "BUY" ? book.bestYesAsk : book.bestYesBid;
  }
  return side === "BUY" ? book.bestNoAsk : book.bestNoBid;
}
