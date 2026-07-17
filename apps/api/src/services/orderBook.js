import { prisma } from "@repo/database";

function aggregateLevels(orders) {
  const map = new Map();
  for (const o of orders) {
    const rem = o.quantity - o.filledQty;
    if (rem <= 0) continue;
    const current = map.get(o.priceCents) || { quantity: 0, orderCount: 0 };
    map.set(o.priceCents, {
      quantity: current.quantity + rem,
      orderCount: current.orderCount + 1,
    });
  }
  return [...map.entries()]
    .map(([priceCents, level]) => ({ priceCents, ...level }))
    .sort((a, b) => a.priceCents - b.priceCents);
}

function withCumulative(levels) {
  let cumulativeQty = 0;
  return levels.map((level) => {
    cumulativeQty += level.quantity;
    return { ...level, cumulativeQty };
  });
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
      yesBids: withCumulative(aggregateLevels(yesBids).sort((a, b) => b.priceCents - a.priceCents)),
      yesAsks: withCumulative(aggregateLevels(yesAsks)),
      noBids: withCumulative(aggregateLevels(noBids).sort((a, b) => b.priceCents - a.priceCents)),
      noAsks: withCumulative(aggregateLevels(noAsks)),
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

/**
 * Lightweight book summaries for MANY markets in a fixed number of queries.
 * Avoids the N+1 explosion of calling getOrderBookSnapshot() per market on the
 * list page. Returns Map<marketId, { impliedYesPrice, spread, volume, best* }>.
 */
export async function getMarketBookSummaries(marketIds) {
  const summaries = new Map();
  if (!marketIds.length) return summaries;

  const [openOrders, volumeByMarket, lastTrades] = await Promise.all([
    prisma.order.findMany({
      where: { marketId: { in: marketIds }, status: "OPEN" },
      select: { marketId: true, outcome: true, side: true, priceCents: true },
    }),
    prisma.trade.groupBy({
      by: ["marketId"],
      where: { marketId: { in: marketIds } },
      _sum: { quantity: true },
    }),
    prisma.trade.findMany({
      where: { marketId: { in: marketIds } },
      orderBy: { createdAt: "desc" },
      distinct: ["marketId"],
      select: { marketId: true, outcome: true, priceCents: true },
    }),
  ]);

  const volumeMap = new Map(
    volumeByMarket.map((v) => [v.marketId, v._sum.quantity ?? 0])
  );
  const lastTradeMap = new Map(lastTrades.map((t) => [t.marketId, t]));

  // Group best prices per market in a single pass.
  const best = new Map();
  for (const id of marketIds) {
    best.set(id, {
      bestYesBid: null,
      bestYesAsk: null,
      bestNoBid: null,
      bestNoAsk: null,
    });
  }
  for (const o of openOrders) {
    const b = best.get(o.marketId);
    if (!b) continue;
    if (o.outcome === "YES" && o.side === "BUY") {
      b.bestYesBid = b.bestYesBid == null ? o.priceCents : Math.max(b.bestYesBid, o.priceCents);
    } else if (o.outcome === "YES" && o.side === "SELL") {
      b.bestYesAsk = b.bestYesAsk == null ? o.priceCents : Math.min(b.bestYesAsk, o.priceCents);
    } else if (o.outcome === "NO" && o.side === "BUY") {
      b.bestNoBid = b.bestNoBid == null ? o.priceCents : Math.max(b.bestNoBid, o.priceCents);
    } else if (o.outcome === "NO" && o.side === "SELL") {
      b.bestNoAsk = b.bestNoAsk == null ? o.priceCents : Math.min(b.bestNoAsk, o.priceCents);
    }
  }

  for (const id of marketIds) {
    const b = best.get(id);
    const lastTrade = lastTradeMap.get(id);

    let impliedYesPrice =
      b.bestYesAsk != null && b.bestYesBid != null
        ? Math.round((b.bestYesAsk + b.bestYesBid) / 2)
        : b.bestYesAsk ?? b.bestYesBid ?? null;
    if (impliedYesPrice == null && lastTrade?.outcome === "YES") {
      impliedYesPrice = lastTrade.priceCents;
    }
    if (impliedYesPrice == null) impliedYesPrice = 50;

    const spread =
      b.bestYesAsk != null && b.bestYesBid != null ? b.bestYesAsk - b.bestYesBid : null;

    summaries.set(id, {
      ...b,
      spread,
      impliedYesPrice,
      volume: volumeMap.get(id) ?? 0,
    });
  }

  return summaries;
}

/** Batched open interest for many markets (single groupBy query). */
export async function getOpenInterestForMarkets(marketIds) {
  const map = new Map();
  if (!marketIds.length) return map;

  const grouped = await prisma.position.groupBy({
    by: ["marketId"],
    where: { marketId: { in: marketIds } },
    _sum: { yesShares: true, noShares: true },
  });
  for (const g of grouped) {
    map.set(g.marketId, (g._sum.yesShares ?? 0) + (g._sum.noShares ?? 0));
  }
  return map;
}
