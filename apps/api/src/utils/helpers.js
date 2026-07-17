import { Prisma } from "@repo/database";

/** Flat market categories (Polymarket-style Finance + Sports). */
export const MARKET_CATEGORIES = [
  "STOCK",
  "COMMODITIES",
  "INDICES",
  "CRYPTO",
  "FOREX",
  "SPORTS",
];

export const MARKET_TIMEFRAMES = ["daily", "weekly", "monthly"];

export function isValidMarketCategory(value) {
  return MARKET_CATEGORIES.includes(value);
}

export function isValidTimeframe(value) {
  return MARKET_TIMEFRAMES.includes(value);
}

/** Resolve-date window for Daily / Weekly / Monthly filters (from start of today UTC). */
export function timeframeDateFilter(timeframe) {
  if (!isValidTimeframe(timeframe)) return null;

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  if (timeframe === "daily") {
    end.setUTCDate(end.getUTCDate() + 2);
  } else if (timeframe === "weekly") {
    end.setUTCDate(end.getUTCDate() + 7);
  } else {
    end.setUTCDate(end.getUTCDate() + 31);
  }

  return { gte: start, lt: end };
}

export function toNumber(value) {
  if (value == null) return 0;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

export function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName ?? null,
    balance: toNumber(user.balance),
    isAdmin: user.isAdmin,
    walletAddress: user.walletAddress ?? null,
    createdAt: user.createdAt,
  };
}

export function formatMarket(market) {
  return {
    id: market.id,
    title: market.title,
    symbol: market.symbol,
    strike: toNumber(market.strike),
    condition: market.condition,
    resolveDate: market.resolveDate,
    status: market.status,
    winningOutcome: market.winningOutcome,
    resolvedPrice: market.resolvedPrice ? toNumber(market.resolvedPrice) : null,
    category: market.category ?? "STOCK",
    description: market.description ?? null,
    externalId: market.externalId ?? null,
    externalSource: market.externalSource ?? null,
    externalEventId: market.externalEventId ?? null,
    externalYesCents: market.externalYesCents ?? null,
    createdAt: market.createdAt,
  };
}

export function maskEmail(email) {
  return email.replace(/(.{2}).+(@.+)/, "$1***$2");
}

export function orderCostCents(priceCents, quantity) {
  return (priceCents * quantity) / 100;
}

export function marketTitle(symbol, strike, condition, resolveDate) {
  const dateStr =
    resolveDate instanceof Date
      ? resolveDate.toISOString().slice(0, 10)
      : String(resolveDate).slice(0, 10);
  const op = condition === "CLOSE_ABOVE" ? "above" : "below";
  return `Will ${symbol} close ${op} $${strike} on ${dateStr}?`;
}
