import { PolymarketUS } from "polymarket-us";
import { Prisma, prisma } from "@repo/database";
import { config } from "../config.js";
import { invalidateMarketsList } from "@repo/platform/cache";

export const POLYMARKET_SOURCE = "POLYMARKET_US";

/** Search queries that return useful open events on Polymarket US. */
const DEFAULT_QUERIES = [
  "bitcoin",
  "crypto",
  "fed",
  "election",
  "nfl",
  "nba",
  "trump",
];

const CATEGORY_MAP = {
  sports: "SPORTS",
  crypto: "CRYPTO",
  commodities: "COMMODITIES",
  commodity: "COMMODITIES",
  forex: "FOREX",
  fx: "FOREX",
  indices: "INDICES",
  index: "INDICES",
  stocks: "STOCK",
  equities: "STOCK",
  finance: "STOCK",
  macro: "INDICES",
  politics: "SPORTS",
  geopolitics: "SPORTS",
};

function createClient() {
  if (config.polymarketKeyId && config.polymarketSecretKey) {
    return new PolymarketUS({
      keyId: config.polymarketKeyId,
      secretKey: config.polymarketSecretKey,
      timeout: 30000,
    });
  }
  // Public market data — no keys required
  return new PolymarketUS();
}

function mapCategory(raw) {
  if (!raw) return "STOCK";
  const key = String(raw).toLowerCase().trim();
  return CATEGORY_MAP[key] || "STOCK";
}

function symbolFromEvent(event) {
  const series = (event.seriesSlug || "").split("-")[0];
  if (series && series.length >= 2 && series.length <= 12) {
    return series.toUpperCase();
  }
  const ticker = (event.ticker || event.slug || "PM").split("-")[0];
  return String(ticker || "PM").toUpperCase().slice(0, 12);
}

function parseStrike(market, index) {
  const blob = `${market.slug || ""} ${market.question || ""} ${market.description || ""}`;
  const money = blob.match(/\$\s*([\d,]+(?:\.\d+)?)\s*([kKmMbB])?/);
  if (money) {
    let n = Number(money[1].replace(/,/g, ""));
    const suf = (money[2] || "").toLowerCase();
    if (suf === "k") n *= 1_000;
    if (suf === "m") n *= 1_000_000;
    if (suf === "b") n *= 1_000_000_000;
    if (Number.isFinite(n) && n > 0) return n;
  }
  const kMatch = (market.slug || "").match(/-(\d+)k(?:-|$)/i);
  if (kMatch) return Number(kMatch[1]) * 1000;
  // Distinct placeholder so multi-outcome cards sort stably
  return index + 1;
}

function yesCentsFromSides(sides = []) {
  const yes = sides.find((s) => /^yes$/i.test(String(s.description || "").trim()));
  if (yes && yes.price != null) {
    const p = Number(yes.price);
    if (Number.isFinite(p)) return Math.round(Math.min(99, Math.max(1, p * 100)));
  }
  const long = sides.find((s) => s.long === true) || sides[0];
  if (long && long.price != null) {
    const p = Number(long.price);
    if (Number.isFinite(p)) return Math.round(Math.min(99, Math.max(1, p * 100)));
  }
  return 50;
}

function resolveDateFrom(market, event) {
  const raw = market.endDate || event.endDate || market.startDate;
  const d = raw ? new Date(raw) : new Date(Date.now() + 30 * 86400000);
  if (Number.isNaN(d.getTime())) {
    const fallback = new Date();
    fallback.setDate(fallback.getDate() + 30);
    return fallback;
  }
  return d;
}

function marketStatus(market) {
  if (market.closed || market.archived) return "CLOSED";
  if (market.active === false) return "CLOSED";
  return "OPEN";
}

/**
 * Upsert Polymarket US catalog into local Market rows.
 * Never modifies seed/local markets (externalId null).
 */
export async function syncPolymarketMarkets(options = {}) {
  const limit = options.limit ?? config.polymarketSyncLimit;
  const queries = options.queries || DEFAULT_QUERIES;
  const client = createClient();

  const eventById = new Map();
  for (const query of queries) {
    try {
      const result = await client.search.query({ query });
      for (const event of result.events || []) {
        if (!event?.id) continue;
        if (event.archived) continue;
        if (event.closed && !options.includeClosed) continue;
        eventById.set(String(event.id), event);
      }
    } catch (err) {
      console.warn(`[polymarket] search "${query}" failed:`, err.message);
    }
  }

  // Prefer events that still have nested markets; fetch detail if needed
  const events = [...eventById.values()].slice(0, Math.max(limit, 10));
  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const event of events) {
    let markets = Array.isArray(event.markets) ? event.markets : [];
    if (markets.length === 0 && event.slug) {
      try {
        const detail = await client.events.retrieveBySlug(event.slug);
        const full = detail?.event || detail;
        markets = full?.markets || [];
      } catch {
        /* keep empty */
      }
    }

    const category = mapCategory(event.category || markets[0]?.category);
    const symbol = symbolFromEvent(event);
    const eventExternalId = String(event.id);

    let idx = 0;
    for (const pm of markets) {
      if (!pm?.id) {
        skipped += 1;
        continue;
      }
      if (!options.includeClosed && (pm.closed || pm.archived || pm.active === false)) {
        skipped += 1;
        continue;
      }

      const externalId = `pmus:${pm.id}`;
      const strike = parseStrike(pm, idx);
      idx += 1;
      const yesCents = yesCentsFromSides(pm.marketSides || []);
      const resolveDate = resolveDateFrom(pm, event);
      const title = String(pm.question || event.title || externalId).slice(0, 280);
      const description = [
        pm.description || event.description || "",
        `Source: Polymarket US (${pm.slug || event.slug || externalId})`,
      ]
        .filter(Boolean)
        .join("\n\n")
        .slice(0, 2000);

      const data = {
        title,
        symbol,
        strike: new Prisma.Decimal(strike),
        condition: "CLOSE_ABOVE",
        category,
        description,
        resolveDate,
        status: marketStatus(pm),
        externalId,
        externalSource: POLYMARKET_SOURCE,
        externalEventId: eventExternalId,
        externalYesCents: yesCents,
      };

      const existing = await prisma.market.findUnique({ where: { externalId } });
      if (existing) {
        if (existing.externalSource && existing.externalSource !== POLYMARKET_SOURCE) {
          skipped += 1;
          continue;
        }
        await prisma.market.update({
          where: { id: existing.id },
          data: {
            title: data.title,
            symbol: data.symbol,
            strike: data.strike,
            category: data.category,
            description: data.description,
            resolveDate: data.resolveDate,
            status: existing.status === "RESOLVED" ? "RESOLVED" : data.status,
            externalEventId: data.externalEventId,
            externalYesCents: data.externalYesCents,
            externalSource: POLYMARKET_SOURCE,
          },
        });
        updated += 1;
      } else {
        await prisma.market.create({ data });
        created += 1;
      }

      if (created + updated >= limit) break;
    }
    if (created + updated >= limit) break;
  }

  await invalidateMarketsList();

  return {
    ok: true,
    source: POLYMARKET_SOURCE,
    queries,
    eventsSeen: events.length,
    created,
    updated,
    skipped,
    totalTouched: created + updated,
  };
}
