/** Flat market categories — keep in sync with Prisma MarketCategory. */
export const MARKET_CATEGORIES = [
  { id: "STOCK", label: "Stocks", icon: "📈" },
  { id: "COMMODITIES", label: "Commodities", icon: "🛢️" },
  { id: "INDICES", label: "Indices", icon: "📊" },
  { id: "CRYPTO", label: "Crypto", icon: "₿" },
  { id: "FOREX", label: "Forex", icon: "💱" },
  { id: "SPORTS", label: "Sports", icon: "🏆" },
];

export const CATEGORY_LABELS = Object.fromEntries(
  MARKET_CATEGORIES.map((c) => [c.id, c.label])
);

export function categoryLabel(id) {
  return CATEGORY_LABELS[id] || id || "Markets";
}

/** Fallback topic chips when facets haven't loaded yet. */
export const DEFAULT_TOPIC_CHIPS = {
  STOCK: ["AAPL", "TSLA", "NVDA", "MSFT", "AMZN", "GOOGL", "META", "AMD"],
  COMMODITIES: ["GOLD", "SILVER", "WTI", "URANIUM"],
  INDICES: ["SPY", "QQQ"],
  CRYPTO: ["BTC", "ETH"],
  FOREX: ["EURUSD"],
  SPORTS: ["NBA", "NFL"],
};
