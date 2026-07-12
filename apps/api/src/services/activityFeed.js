import { prisma } from "@repo/database";
import { formatMarket, maskEmail } from "../utils/helpers.js";
import { cacheGet, cacheSet, cacheDel } from "@repo/platform/redis";

const CACHE_KEY = "cache:activity:global:v1";
const TTL = 15;

export async function getGlobalActivity(limit = 40) {
  const cached = await cacheGet(CACHE_KEY);
  if (cached) return cached;

  const trades = await prisma.trade.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      market: true,
      buyer: { select: { displayName: true, email: true } },
      seller: { select: { displayName: true, email: true } },
    },
  });

  const feed = trades.map((t) => ({
    id: t.id,
    type: "trade",
    at: t.createdAt,
    market: formatMarket(t.market),
    outcome: t.outcome,
    priceCents: t.priceCents,
    quantity: t.quantity,
    buyer: t.buyer.displayName || maskEmail(t.buyer.email),
    seller: t.seller.displayName || maskEmail(t.seller.email),
    text: `${t.quantity} ${t.outcome} @ ${t.priceCents}¢ on ${t.market.symbol}`,
  }));

  await cacheSet(CACHE_KEY, feed, TTL);
  return feed;
}

export async function invalidateActivityCache() {
  await cacheDel(CACHE_KEY);
}
