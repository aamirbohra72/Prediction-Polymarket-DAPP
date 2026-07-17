import { optionalAuth } from "../middleware/optionalAuth.js";
import {
  formatMarket,
  maskEmail,
  MARKET_CATEGORIES,
  isValidMarketCategory,
  isValidTimeframe,
  timeframeDateFilter,
} from "../utils/helpers.js";
import {
  getOrderBookSnapshot,
  getMarketExecutionPrice,
  getMarketBookSummaries,
  getOpenInterestForMarkets,
} from "../services/orderBook.js";
import { getPriceHistory } from "../services/priceHistory.js";
import { tryMatchOrder, mintSharesForBuy, releaseSharesForSell } from "../services/matching.js";
import { emitOrderPlaced } from "../services/eventBus.js";
import { invalidateLeaderboard, invalidateMarketsList, CACHE_KEYS } from "@repo/platform/cache";
import { cacheGet, cacheSet } from "@repo/platform/redis";
import { isKafkaEnabled, isProducerReady } from "@repo/kafka";
import { getMarketOpenInterest } from "../services/stats.js";
import { fetchLiveQuote } from "../services/stockPrice.js";
import { invalidateActivityCache } from "../services/activityFeed.js";
import { requireAuth } from "../middleware/auth.js";
import { Router } from "express";
import { prisma } from "@repo/database";
import { config } from "../config.js";

const router = Router();

function marketsCacheKey(query) {
  const { status, symbol, sort, category, timeframe, watchlist } = query;
  if (watchlist === "true" || symbol) return null; // user/filter-specific — skip shared cache
  return [
    status || "all",
    category || "all",
    timeframe || "all",
    sort || "default",
  ].join(":");
}

router.get("/", optionalAuth, async (req, res) => {
  const { status, symbol, sort, category, timeframe, watchlist } = req.query;
  const cacheKeyPart = marketsCacheKey(req.query);
  const redisKey = cacheKeyPart ? CACHE_KEYS.marketsList(cacheKeyPart) : null;

  const where = {};

  if (status && ["OPEN", "CLOSED", "RESOLVED"].includes(status)) {
    where.status = status;
  }
  if (symbol) {
    where.symbol = { contains: String(symbol).toUpperCase(), mode: "insensitive" };
  }
  if (category && isValidMarketCategory(category)) {
    where.category = category;
  }
  if (timeframe && isValidTimeframe(String(timeframe).toLowerCase())) {
    const range = timeframeDateFilter(String(timeframe).toLowerCase());
    if (range) where.resolveDate = range;
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

  // Base market list is user-independent (no watchlist flag) so it can be
  // shared across all users via cache. The N+1 book/OI lookups are batched.
  let baseMarkets = null;
  let cachedAt = null;

  if (redisKey) {
    const cached = await cacheGet(redisKey);
    if (cached?.markets) {
      baseMarkets = cached.markets;
      cachedAt = cached.cachedAt;
    }
  }

  if (!baseMarkets) {
    const markets = await prisma.market.findMany({
      where,
      orderBy: [{ status: "asc" }, { resolveDate: "asc" }],
    });
    const ids = markets.map((m) => m.id);

    const [summaries, oiMap] = await Promise.all([
      getMarketBookSummaries(ids),
      getOpenInterestForMarkets(ids),
    ]);

    baseMarkets = markets.map((m) => {
      const book = summaries.get(m.id) ?? { impliedYesPrice: 50, spread: null, volume: 0 };
      const implied =
        book.volume > 0 || book.spread != null
          ? book.impliedYesPrice
          : m.externalYesCents ?? book.impliedYesPrice ?? 50;
      return {
        ...formatMarket(m),
        ...book,
        impliedYesPrice: implied,
        openInterest: oiMap.get(m.id) ?? 0,
      };
    });

    if (sort === "volume") {
      baseMarkets.sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0));
    } else if (sort === "yesPrice") {
      baseMarkets.sort((a, b) => (b.impliedYesPrice ?? 0) - (a.impliedYesPrice ?? 0));
    } else if (sort === "resolveDate") {
      baseMarkets.sort(
        (a, b) => new Date(a.resolveDate).getTime() - new Date(b.resolveDate).getTime()
      );
    }

    if (redisKey) {
      cachedAt = Date.now();
      await cacheSet(
        redisKey,
        { markets: baseMarkets, cachedAt },
        config.cacheLeaderboardTtl || 60
      );
    }
  }

  let watchSet = new Set();
  if (req.user) {
    const wl = await prisma.watchlist.findMany({
      where: { userId: req.user.id },
      select: { marketId: true },
    });
    watchSet = new Set(wl.map((w) => w.marketId));
  }

  const marketsOut = baseMarkets.map((m) => ({
    ...m,
    watchlisted: watchSet.has(m.id),
  }));

  res.json({
    markets: marketsOut,
    meta: { cached: cachedAt != null && baseMarkets != null, cachedAt },
  });
});

/** Category counts + symbols-per-category for sidebar / pill filters. */
router.get("/facets", async (_req, res) => {
  const openWhere = { status: { in: ["OPEN", "CLOSED"] } };

  const [byCategory, bySymbol, dailyCount, weeklyCount, monthlyCount] =
    await Promise.all([
      prisma.market.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: openWhere,
      }),
      prisma.market.groupBy({
        by: ["category", "symbol"],
        _count: { _all: true },
        where: openWhere,
      }),
      prisma.market.count({
        where: { ...openWhere, resolveDate: timeframeDateFilter("daily") },
      }),
      prisma.market.count({
        where: { ...openWhere, resolveDate: timeframeDateFilter("weekly") },
      }),
      prisma.market.count({
        where: { ...openWhere, resolveDate: timeframeDateFilter("monthly") },
      }),
    ]);

  const total = byCategory.reduce((sum, row) => sum + row._count._all, 0);
  const categories = {};
  for (const id of MARKET_CATEGORIES) {
    categories[id] = 0;
  }
  for (const row of byCategory) {
    categories[row.category] = row._count._all;
  }

  const symbolsByCategory = {};
  for (const id of MARKET_CATEGORIES) {
    symbolsByCategory[id] = [];
  }
  const sortedSymbols = [...bySymbol].sort(
    (a, b) => b._count._all - a._count._all || a.symbol.localeCompare(b.symbol)
  );
  for (const row of sortedSymbols) {
    const list = symbolsByCategory[row.category];
    if (!list || list.length >= 12) continue;
    list.push({ symbol: row.symbol, count: row._count._all });
  }

  res.json({
    total,
    categories,
    symbolsByCategory,
    timeframes: {
      daily: dailyCount,
      weekly: weeklyCount,
      monthly: monthlyCount,
    },
  });
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
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) return res.status(404).json({ error: "Market not found" });

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

  const activity = [
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
  ];

  if (market.status === "RESOLVED") {
    activity.push({
      type: "resolution",
      at: market.resolveDate,
      text: `Market resolved ${market.winningOutcome || "—"}`,
    });
  }

  activity.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  res.json({ activity });
});

router.get("/:id/comments", optionalAuth, async (req, res) => {
  const viewerId = req.user?.id;
  const comments = await prisma.marketComment.findMany({
    where: { marketId: req.params.id, parentId: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      user: { select: { id: true, displayName: true, email: true } },
      replies: {
        orderBy: { createdAt: "asc" },
        take: 20,
        include: {
          user: { select: { id: true, displayName: true, email: true } },
          _count: { select: { likes: true } },
          likes: viewerId
            ? { where: { userId: viewerId }, select: { id: true } }
            : false,
        },
      },
      _count: { select: { likes: true, replies: true } },
      likes: viewerId
        ? { where: { userId: viewerId }, select: { id: true } }
        : false,
    },
  });

  res.json({
    comments: comments.map((c) => ({
      id: c.id,
      body: c.body,
      author: c.user.displayName || maskEmail(c.user.email),
      authorId: c.user.id,
      createdAt: c.createdAt,
      likeCount: c._count.likes,
      replyCount: c._count.replies,
      likedByMe: Array.isArray(c.likes) ? c.likes.length > 0 : false,
      replies: (c.replies || []).map((r) => ({
        id: r.id,
        body: r.body,
        author: r.user.displayName || maskEmail(r.user.email),
        authorId: r.user.id,
        createdAt: r.createdAt,
        likeCount: r._count.likes,
        likedByMe: Array.isArray(r.likes) ? r.likes.length > 0 : false,
      })),
    })),
  });
});

router.post("/:id/comments", requireAuth, async (req, res) => {
  const { body, parentId } = req.body;
  if (!body || String(body).trim().length < 2) {
    return res.status(400).json({ error: "Comment too short" });
  }
  if (String(body).length > 500) {
    return res.status(400).json({ error: "Comment max 500 chars" });
  }

  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) return res.status(404).json({ error: "Market not found" });

  if (parentId) {
    const parent = await prisma.marketComment.findFirst({
      where: { id: parentId, marketId: market.id },
    });
    if (!parent) return res.status(404).json({ error: "Parent comment not found" });
  }

  const comment = await prisma.marketComment.create({
    data: {
      userId: req.user.id,
      marketId: market.id,
      body: String(body).trim(),
      parentId: parentId || null,
    },
  });

  await invalidateActivityCache().catch(() => {});

  res.status(201).json({
    comment: {
      id: comment.id,
      body: comment.body,
      parentId: comment.parentId,
      createdAt: comment.createdAt,
    },
  });
});

router.post("/:id/comments/:commentId/like", requireAuth, async (req, res) => {
  const comment = await prisma.marketComment.findFirst({
    where: { id: req.params.commentId, marketId: req.params.id },
  });
  if (!comment) return res.status(404).json({ error: "Comment not found" });

  await prisma.commentLike.upsert({
    where: {
      userId_commentId: { userId: req.user.id, commentId: comment.id },
    },
    create: { userId: req.user.id, commentId: comment.id },
    update: {},
  });
  const likeCount = await prisma.commentLike.count({ where: { commentId: comment.id } });
  res.json({ liked: true, likeCount });
});

router.delete("/:id/comments/:commentId/like", requireAuth, async (req, res) => {
  await prisma.commentLike.deleteMany({
    where: { userId: req.user.id, commentId: req.params.commentId },
  });
  const likeCount = await prisma.commentLike.count({
    where: { commentId: req.params.commentId },
  });
  res.json({ liked: false, likeCount });
});

router.get("/:id", optionalAuth, async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.id } });
  if (!market) {
    return res.status(404).json({ error: "Market not found" });
  }

  const book = await getOrderBookSnapshot(market.id);
  const history = await getPriceHistory(market.id);
  const openInterest = await getMarketOpenInterest(market.id);
  const quote =
    market.status === "OPEN" && !market.externalSource
      ? await fetchLiveQuote(market.symbol)
      : null;

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

  const formatted = formatMarket(market);
  const impliedYesPrice =
    book.volume > 0
      ? book.impliedYesPrice
      : market.externalYesCents ?? book.impliedYesPrice ?? 50;

  res.json({
    market: {
      ...formatted,
      ...book,
      impliedYesPrice,
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
