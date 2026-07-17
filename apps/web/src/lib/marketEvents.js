/** Shared symbol icons for market cards. */
export const SYMBOL_EMOJI = {
  AAPL: "🍎",
  TSLA: "⚡",
  NVDA: "🎮",
  MSFT: "🪟",
  AMZN: "📦",
  GOOGL: "🔍",
  META: "📘",
  AMD: "💻",
  NFLX: "🎬",
  SPY: "📊",
  QQQ: "📉",
  BTC: "₿",
  ETH: "Ξ",
  GOLD: "🥇",
  SILVER: "🥈",
  WTI: "🛢️",
  URANIUM: "⚛️",
  EURUSD: "💶",
  NBA: "🏀",
  NFL: "🏈",
};

export function symbolEmoji(symbol) {
  return SYMBOL_EMOJI[symbol] || "📈";
}

/**
 * Group flat markets into Polymarket-style events:
 * prefer externalEventId; else same symbol + resolve month.
 */
export function groupMarketsIntoEvents(markets) {
  const map = new Map();

  for (const m of markets) {
    const d = new Date(m.resolveDate);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    const key = m.externalEventId
      ? `ext:${m.externalEventId}`
      : `${m.category || "STOCK"}|${m.symbol}|${monthKey}`;

    if (!map.has(key)) {
      map.set(key, {
        id: key,
        symbol: m.symbol,
        category: m.category || "STOCK",
        monthKey,
        resolveDate: m.resolveDate,
        externalSource: m.externalSource || null,
        markets: [],
      });
    }
    map.get(key).markets.push(m);
  }

  const events = [...map.values()].map((ev) => {
    const sorted = [...ev.markets].sort((a, b) => {
      const sa = Number(a.strike) || 0;
      const sb = Number(b.strike) || 0;
      return sa - sb;
    });
    const volume = sorted.reduce((sum, m) => sum + (m.volume ?? 0), 0);
    const top = sorted.reduce(
      (best, m) =>
        (m.impliedYesPrice ?? 0) > (best.impliedYesPrice ?? 0) ? m : best,
      sorted[0]
    );
    const earliest = sorted.reduce(
      (min, m) =>
        new Date(m.resolveDate) < new Date(min.resolveDate) ? m : min,
      sorted[0]
    );

    return {
      ...ev,
      markets: sorted,
      volume,
      impliedYesPrice: top?.impliedYesPrice ?? 50,
      resolveDate: earliest.resolveDate,
      title: ev.externalSource
        ? sorted[0]?.title || eventTitle(ev.symbol, earliest.resolveDate)
        : eventTitle(ev.symbol, earliest.resolveDate),
      timeframeLabel: timeframeLabelForDate(earliest.resolveDate),
    };
  });

  return events.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
}

function eventTitle(symbol, resolveDate) {
  const d = new Date(resolveDate);
  const month = d.toLocaleString("en-US", { month: "long", timeZone: "UTC" });
  const year = d.getUTCFullYear();
  return `What will ${symbol} hit in ${month} ${year}?`;
}

export function timeframeLabelForDate(resolveDate) {
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const end = new Date(resolveDate);
  const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  if (days <= 2) return "Daily";
  if (days <= 7) return "Weekly";
  return "Monthly";
}

export function formatStrike(strike, condition) {
  const n = Number(strike);
  const arrow = condition === "CLOSE_BELOW" ? "↓" : "↑";
  if (!Number.isFinite(n)) return `${arrow} —`;
  if (n >= 1000) return `${arrow} $${n.toLocaleString("en-US")}`;
  if (n < 10 && !Number.isInteger(n)) return `${arrow} $${n.toFixed(2)}`;
  return `${arrow} $${n}`;
}
