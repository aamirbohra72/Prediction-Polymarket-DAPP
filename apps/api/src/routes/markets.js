import { Router } from "express";
import { prisma } from "@repo/database";
import { config } from "../config.js";
import { requireAuth } from "../middleware/auth.js";
import { optionalAuth } from "../middleware/optionalAuth.js";
import { formatMarket, maskEmail } from "../utils/helpers.js";
import { getOrderBookSnapshot, getMarketExecutionPrice } from "../services/orderBook.js";
import { getPriceHistory } from "../services/priceHistory.js";
import { tryMatchOrder, mintSharesForBuy, releaseSharesForSell } from "../services/matching.js";
import { emitOrderPlaced } from "../services/eventBus.js";
import { invalidateLeaderboard, invalidateMarketsList, CACHE_KEYS } from "@repo/platform/cache";
import { cacheGet, cacheSet } from "@repo/platform/redis";
import { isKafkaEnabled, isProducerReady } from "@repo/kafka";
import { getMarketOpenInterest } from "../services/stats.js";
import { fetchLiveQuote } from "../services/stockPrice.js";

const router = Router();

function marketsCacheKey(query) {
  const { status, symbol, sort, category, watchlist } = query;
  if (watchlist === "true" || symbol) return null; // user/filter-specific — skip shared cache
  return [
    status || "all",
    category || "all",
    sort || "default",
  ].join(":");
}

router.get("/", optionalAuth, async (req, res) => {
  const { status, symbol, sort, category, watchlist } = req.query;
  const cacheKeyPart = marketsCacheKey(req.query);
  const redisKey = cacheKeyPart ? CACHE_KEYS.marketsList(cacheKeyPart) : null;

  if (redisKey && !req.user) {
    const cached = await cacheGet(redisKey);
    if (cached?.markets) {
      return res.json({ markets: cached.markets, meta: { cached: true, cachedAt: cached.cachedAt } });
    }
  }

  const where = {};

  if (status && ["OPEN", "CLOSED", "RESOLVED"].includes(status)) {
    where.status = status;
  }
  if (symbol) {
    where.symbol = { contains: String(symbol).toUpperCase(), mode: "insensitive" };
  }
  if (category && ["STOCK", "SPORTS"].includes(category)) {
    where.category = category;
  }

  let marketIds = null;
  if (watchlist === "true" && req.user) {
    const wl = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      select: { marketId: true },
    });
    marketIds = wl.map((w) => w.marketId);
    if (marketIds.length === 0) {
      return res.json({ markets: [] });
    }
    where.id = { in: marketIds };
  }

  const markets = await prisma.market.findMany({
    where,
    orderBy: [{ status: "asc" }, { resolveDate: "asc" }],
  });

  let watchSet = new Set();
  if (req.user) {
    const wl = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      select: { marketId: true },
    });
    watchSet = new Set(wl.map((w) => w.marketId));
  }

  const enriched = await Promise.all(
    markets.map(async (m) => {
      const book = await getOrderBookSnapshot(m.id);
      const openInterest = await getMarketOpenInterest(m.id);
      return {
        ...formatMarket(m),
        ...book,
        openInterest,
        watchlisted: watchSet.has(m.id),
      };
    })
  );

  const sorted = [...enriched];
  if (sort === "volume") {
    sorted.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
  } else if (sort === "yesPrice") {
    sorted.sort((a, b) => (b.impliedYesPrice ?? 0) - (a.impliedYesPrice ?? 0));
  } else if (sort === "resolveDate") {
    sorted.sort(
      (a, b) => new Date(a.resolveDate).getTime() - new Date(b.resolveDate).getTime()
    );
  }

  if (redisKey && !req.user) {
    await cacheSet(
      redisKey,
      { markets: sorted, cachedAt: Date.now() },
      config.cacheLeaderboardTtl || 60
    );
  }

  res.json({ markets: sorted, meta: { cached: false } });
});

router.get("/:id/history", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) return res.status(404).json({ error: "Market not found" });

  const history = await getPriceHistory(req.params.id);
  res.json({ history });
});

router.get("/:id/quote", async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) return res.status(404).json({ error: "Market not found" });
  const quote = await fetchLiveQuote(market.symbol);
  res.json({ symbol: market.symbol, quote });
});

router.get("/:id/activity", async (req, res) => {
  const marketId = req.params.id;
  const [trades, comments] = await Promise.all([
    prisma.trade.findMany({
      where: { marketId },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.marketComment.findMany({
      where: { marketId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { user: { select: { displayName: true, email: true } } },
    }),
  ]);

  res.json({
    activity: [
      ...trades.map((t) => ({
        type: "trade",
        at: t.createdAt,
        text: `${t.quantity} ${t.outcome} traded @ ${t.priceCents}¢`,
      })),
      ...comments.map((c) => ({
        type: "comment",
        at: c.createdAt,
        text: c.body,
        author: c.user.displayName || maskEmail(c.user.email),
      })),
    ].sort((a, b) => new Date(b.at) - new Date(a.at)),
  });
});

router.get("/:id/comments", async (req, res) => {
  const comments = await prisma.marketComment.findMany({
    where: { marketId: req.params.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { user: { select: { displayName: true, email: true } } },
  });
  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.user.displayName || maskEmail(c.user.email),
      createdAt: c.createdAt,
    })),
  });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const { body } = req.body;
  if (!body || String(body).trim().length < 2) {
    return res.status(400).json({ error: "Comment too short" });
  }
  if (String(body).length > 500) {
    return res.status(400).json({ error: "Comment max 500 chars" });
  }

  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) return res.status(404).json({ error: "Market not found" });

  const comment = await prisma.marketComment.create({
    data: {
      userId: req.user.id,
      marketId: market.id,
      body: String(body).trim(),
    },
  });

  res.status(201).json({ comment });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    return res.status(404).json({ error: "Market not found" });
  }

  const book = await getOrderBookSnapshot(market.id);
  const history = await getPriceHistory(market.id);
  const openInterest = await getMarketOpenInterest(market.id);
  const quote = market.status === "OPEN" ? await fetchLiveQuote(market.symbol) : null;

  const relatedMarkets = await prisma.market.findMany({
    where: { symbol: market.symbol, id: { not: market.id } },
    orderBy: { resolveDate: "asc" },
    take: 5,
  });

  let watchlisted = false;
  let myOpenOrders = [];
  if (req.user) {
    const wl = await prisma.watchlist.findUnique({
      where: { userId_marketId: { userId: req.user.id, marketId: market.id } },
    });
    watchlisted = !!wl;
    myOpenOrders = await prisma.order.findMany({
      where: { userId: req.user.id, marketId: market.id, status: "OPEN" },
      orderBy: { createdAt: "desc" },
    });
  }

  res.json({
    market: {
      ...formatMarket(market),
      ...book,
      priceHistory: history,
      openInterest,
      liveQuote: quote,
      watchlisted,
      myOpenOrders,
      relatedMarkets: relatedMarkets.map(formatMarket),
    },
  });
});

router.post("/:id/orders", requireAuth, async (req, res) => {
  try {
    const { outcome, side, priceCents, quantity, orderType } = req.body;
    const type = orderType === "MARKET" ? "MARKET" : "LIMIT";

    if (!["YES", "NO"].includes(outcome)) {
      return res.status(400).json({ error: "outcome must be YES or NO" });
    }
    if (!["BUY", "SELL"].includes(side)) {
      return res.status(400).json({ error: "side must be BUY or SELL" });
    }
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10000) {
      return res.status(400).json({ error: "quantity must be a positive integer" });
    }

    const market = await prisma.market.findUnique({ where: { id: req.params.id } });
    if (!market || market.status !== "OPEN") {
      return res.status(400).json({ error: "Market is not open for trading" });
    }

    const book = await getOrderBookSnapshot(market.id);
    let price;
    if (type === "MARKET") {
      const exec = getMarketExecutionPrice(book, outcome, side);
      if (exec == null) {
        return res.status(400).json({
          error: "No liquidity for market order — place a limit order or wait for quotes",
        });
      }
      price = exec;
    } else {
      price = Number(priceCents);
      if (!Number.isInteger(price) || price < 1 || price > 99) {
        return res.status(400).json({ error: "priceCents must be 1-99" });
      }
    }
    if (side === "SELL") {
      const position = await prisma.position.findUnique({
        where: { userId_marketId: { userId: req.user.id, marketId: market.id } },
      });
      const held = outcome === "YES" ? position?.yesShares ?? 0 : position?.noShares ?? 0;
      if (held < qty) {
        return res.status(400).json({ error: `Insufficient ${outcome} shares (have ${held})` });
      }
    }

    const order = await prisma.order.create({
      data: {
        userId: req.user.id,
        marketId: market.id,
        outcome,
        side,
        priceCents: price,
        quantity: qty,
      },
    });

    await tryMatchOrder(order.id);

    const refreshed = await prisma.order.findUnique({ where: { id: order.id } });
    const stillOpen = refreshed.status === "OPEN" && refreshed.filledQty < refreshed.quantity;

    if (config.mintUnfilledOrders && stillOpen && side === "BUY") {
      const remaining = refreshed.quantity - refreshed.filledQty;
      try {
        await mintSharesForBuy(req.user.id, market.id, outcome, remaining, price);
        await prisma.order.update({
          where: { id: order.id },
          data: { filledQty: refreshed.quantity, status: "FILLED" },
        });
      } catch (e) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });
        return res.status(400).json({ error: e.message });
      }
    } else if (config.mintUnfilledOrders && stillOpen && side === "SELL") {
      const remaining = refreshed.quantity - refreshed.filledQty;
      try {
        await releaseSharesForSell(req.user.id, market.id, outcome, remaining, price);
        await prisma.order.update({
          where: { id: order.id },
          data: { filledQty: refreshed.quantity, status: "FILLED" },
        });
      } catch (e) {
        await prisma.order.update({
          where: { id: order.id },
          data: { status: "CANCELLED" },
        });
        return res.status(400).json({ error: e.message });
      }
    } else if (stillOpen) {
      return res.status(201).json({
        order: refreshed,
        message: "Order resting on book (no counterparty). Cancel or wait for a match.",
        resting: true,
      });
    }

    const finalOrder = await prisma.order.findUnique({ where: { id: order.id } });
    const user = await prisma.user.findUnique({ where: { id: req.user.id } });

    await emitOrderPlaced({
      userId: req.user.id,
      marketId: market.id,
      orderId: finalOrder.id,
    });
    if (!isKafkaEnabled() || !isProducerReady()) {
      await invalidateLeaderboard();
      await invalidateMarketsList();
    }

    res.status(201).json({
      order: finalOrder,
      balance: Number(user.balance),
      orderType: type,
      executedPriceCents: price,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || "Failed to place order" });
  }
});

export default router;
