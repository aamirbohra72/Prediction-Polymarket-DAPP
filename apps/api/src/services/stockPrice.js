import { config } from "../config.js";

function toUnix(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

export async function fetchDailyClose(symbol, resolveDate) {
  if (!config.finnhubApiKey) {
    throw new Error("FINNHUB_API_KEY is not configured");
  }

  const d = new Date(resolveDate);
  const from = new Date(d);
  from.setDate(from.getDate() - 5);
  const to = new Date(d);
  to.setDate(to.getDate() + 1);

  const url = new URL("https://finnhub.io/api/v1/stock/candle");
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("resolution", "D");
  url.searchParams.set("from", String(toUnix(from)));
  url.searchParams.set("to", String(toUnix(to)));
  url.searchParams.set("token", config.finnhubApiKey);

  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      if (data.s === "ok" && data.t?.length) {
        const target = d.toISOString().slice(0, 10);
        let bestIdx = -1;
        for (let i = 0; i < data.t.length; i++) {
          const day = new Date(data.t[i] * 1000).toISOString().slice(0, 10);
          if (day === target) {
            bestIdx = i;
            break;
          }
        }
        if (bestIdx === -1) bestIdx = data.t.length - 1;
        return data.c[bestIdx];
      }
    } else {
      console.warn(
        `[finnhub] candle ${symbol} HTTP ${res.status} — falling back to quote`
      );
    }
  } catch (e) {
    console.warn(`[finnhub] candle ${symbol} error:`, e.message, "— falling back to quote");
  }

  // Free-tier / outage fallback: /quote works; use previous close (or last).
  const quote = await fetchLiveQuote(symbol);
  if (quote?.prevClose) return quote.prevClose;
  if (quote?.current) return quote.current;
  throw new Error(`No price data for ${symbol} on ${d.toISOString().slice(0, 10)}`);
}

export async function fetchLiveQuote(symbol) {
  if (!config.finnhubApiKey) return null;

  const url = new URL("https://finnhub.io/api/v1/quote");
  url.searchParams.set("symbol", symbol.toUpperCase());
  url.searchParams.set("token", config.finnhubApiKey);

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();
  if (data.c == null || data.c === 0) return null;

  return {
    current: data.c,
    change: data.d,
    changePercent: data.dp,
    high: data.h,
    low: data.l,
    prevClose: data.pc,
  };
}

export function evaluateOutcome(condition, strike, closePrice) {
  if (condition === "CLOSE_ABOVE") {
    return closePrice > strike ? "YES" : "NO";
  }
  return closePrice < strike ? "YES" : "NO";
}
