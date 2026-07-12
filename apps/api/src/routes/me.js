import { Router } from "express";
import { prisma } from "@repo/database";
import { requireAuth } from "../middleware/auth.js";
import { formatUser, formatMarket, toNumber } from "../utils/helpers.js";
import { getUserStatsCached, getPortfolioBundleCached } from "../services/portfolioCache.js";
import { getOrderBookSnapshot } from "../services/orderBook.js";
import { invalidateUserCache } from "../services/cacheKeys.js";
import { getUserAnalytics } from "../services/analytics.js";

const router = Router();

router.get("/", requireAuth, (req, res) => {
  res.json({ user: formatUser(req.user) });
});

router.patch("/profile", requireAuth, async (req, res) => {
  const { displayName } = req.body;
  const name = displayName != null ? String(displayName).trim().slice(0, 32) : null;

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { displayName: name || null },
  });

  await invalidateUserCache(req.user.id);
  res.json({ user: formatUser(user) });
});

router.get("/portfolio", requireAuth, async (req, res) => {
  const data = await getPortfolioBundleCached(req.user);
  res.json({
    user: data.user,
    stats: data.stats,
    positions: data.positions,
    transactions: data.transactions,
    meta: { cached: data.fromCache, cachedAt: data.cachedAt },
  });
});

router.get("/stats", requireAuth, async (req, res) => {
  const { stats, fromCache } = await getUserStatsCached(req.user.id);
  res.json({ stats, meta: { cached: fromCache } });
});

router.get("/analytics", requireAuth, async (req, res) => {
  const analytics = await getUserAnalytics(req.user.id);
  res.json({ analytics });
});

router.get("/orders/open", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id, status: "OPEN" },
    orderBy: { createdAt: "desc" },
    include: { market: true },
  });
  res.json({
    orders: orders
      .filter((o) => o.quantity - o.filledQty > 0)
      .map((o) => ({
        id: o.id,
        market: formatMarket(o.market),
        outcome: o.outcome,
        side: o.side,
        priceCents: o.priceCents,
        quantity: o.quantity,
        filledQty: o.filledQty,
        remaining: o.quantity - o.filledQty,
        createdAt: o.createdAt,
      })),
  });
});

router.get("/positions", requireAuth, async (req, res) => {
  const positions = await prisma.position.findMany({
    where: {
      userId: req.user.id,
      OR: [{ yesShares: { gt: 0 } }, { noShares: { gt: 0 } }],
    },
    include: { market: true },
  });

  const enriched = await Promise.all(
    positions.map(async (p) => {
      let markValue = 0;
      if (p.market.status !== "RESOLVED") {
        const book = await getOrderBookSnapshot(p.marketId);
        const yesP = (book.impliedYesPrice ?? 50) / 100;
        markValue = p.yesShares * yesP + p.noShares * (1 - yesP);
      }
      return {
        id: p.id,
        market: formatMarket(p.market),
        yesShares: p.yesShares,
        noShares: p.noShares,
        markValue: Math.round(markValue * 100) / 100,
      };
    })
  );

  res.json({ positions: enriched });
});

router.get("/transactions", requireAuth, async (req, res) => {
  const transactions = await prisma.transaction.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  res.json({
    transactions: transactions.map((t) => ({
      id: t.id,
      type: t.type,
      amount: toNumber(t.amount),
      balanceAfter: toNumber(t.balanceAfter),
      marketId: t.marketId,
      note: t.note,
      createdAt: t.createdAt,
    })),
  });
});

router.get("/orders", requireAuth, async (req, res) => {
  const orders = await prisma.order.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { market: true },
  });

  res.json({
    orders: orders.map((o) => ({
      id: o.id,
      market: formatMarket(o.market),
      outcome: o.outcome,
      side: o.side,
      priceCents: o.priceCents,
      quantity: o.quantity,
      filledQty: o.filledQty,
      status: o.status,
      createdAt: o.createdAt,
    })),
  });
});

router.get("/notifications", requireAuth, async (req, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  const unread = await prisma.notification.count({
    where: { userId: req.user.id, read: false },
  });

  res.json({ notifications, unread });
});

router.patch("/notifications/read-all", requireAuth, async (req, res) => {
  await prisma.notification.updateMany({
    where: { userId: req.user.id, read: false },
    data: { read: true },
  });
  res.json({ success: true });
});

router.get("/watchlist", requireAuth, async (req, res) => {
  const items = await prisma.watchlist.findMany({
    where: { userId: req.user.id },
    include: { market: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    watchlist: items.map((w) => ({ marketId: w.marketId, market: formatMarket(w.market) })),
  });
});

router.post("/watchlist/:marketId", requireAuth, async (req, res) => {
  const market = await prisma.market.findUnique({ where: { id: req.params.marketId } });
  if (!market) return res.status(404).json({ error: "Market not found" });

  await prisma.watchlist.upsert({
    where: {
      userId_marketId: { userId: req.user.id, marketId: market.id },
    },
    create: { userId: req.user.id, marketId: market.id },
    update: {},
  });

  res.json({ success: true, watchlisted: true });
});

router.delete("/watchlist/:marketId", requireAuth, async (req, res) => {
  await prisma.watchlist.deleteMany({
    where: { userId: req.user.id, marketId: req.params.marketId },
  });
  res.json({ success: true, watchlisted: false });
});

router.get("/alerts", requireAuth, async (req, res) => {
  const alerts = await prisma.priceAlert.findMany({
    where: { userId: req.user.id },
    include: { market: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({
    alerts: alerts.map((a) => ({
      id: a.id,
      market: formatMarket(a.market),
      targetCents: a.targetCents,
      direction: a.direction,
      triggered: a.triggered,
      createdAt: a.createdAt,
    })),
  });
});

router.post("/alerts", requireAuth, async (req, res) => {
  const { marketId, targetCents, direction } = req.body;
  const target = Number(targetCents);
  if (!marketId || !Number.isInteger(target) || target < 1 || target > 99) {
    return res.status(400).json({ error: "Invalid alert params" });
  }
  if (!["ABOVE", "BELOW"].includes(direction)) {
    return res.status(400).json({ error: "direction must be ABOVE or BELOW" });
  }

  const alert = await prisma.priceAlert.create({
    data: {
      userId: req.user.id,
      marketId,
      targetCents: target,
      direction,
    },
  });

  res.status(201).json({ alert });
});

router.delete("/alerts/:id", requireAuth, async (req, res) => {
  await prisma.priceAlert.deleteMany({
    where: { id: req.params.id, userId: req.user.id },
  });
  res.json({ success: true });
});

export default router;
