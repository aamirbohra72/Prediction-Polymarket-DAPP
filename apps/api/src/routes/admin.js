import { Router } from "express";
import { prisma, Prisma } from "@repo/database";
import { requireAdmin } from "../middleware/auth.js";
import { formatMarket, marketTitle } from "../utils/helpers.js";
import { resolveMarket } from "../services/resolution.js";
import { runScheduledTasks } from "../services/scheduler.js";
import { getPlatformStats } from "../services/stats.js";
import { sendEmailToUser, isEmailEnabled } from "@repo/platform/email";
import {
  registerMarketOnChain,
  settleMarketOnChainRecord,
  syncAllMarketsOnChain,
  listOnChainMarkets,
  getMarketOnChainStatus,
  autoInitAfterCreate,
} from "../services/onChainMarket.js";
import { getSolanaConfig, isProgramConfigured } from "@repo/solana";

const router = Router();

router.post("/test-email", requireAdmin, async (req, res) => {
  if (!isEmailEnabled()) {
    return res.status(400).json({
      error: "Email not configured. Set BREVO_API_KEY and BREVO_SENDER_EMAIL in .env",
    });
  }
  const result = await sendEmailToUser(req.user.id, {
    subject: "Test email from StockPredict",
    title: "Brevo is connected",
    body: "If you received this, email notifications are working correctly.",
  });
  res.json({ result });
});

router.get("/stats", requireAdmin, async (_req, res) => {
  const stats = await getPlatformStats();
  const recentUsers = await prisma.user.count({
    where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
  });
  res.json({ stats: { ...stats, newUsersThisWeek: recentUsers } });
});

router.post("/markets", requireAdmin, async (req, res) => {
  try {
    const { symbol, strike, condition, resolveDate, title, category, description } = req.body;

    if (!symbol || strike == null || !condition || !resolveDate) {
      return res.status(400).json({
        error: "symbol, strike, condition, resolveDate are required",
      });
    }

    if (!["CLOSE_ABOVE", "CLOSE_BELOW"].includes(condition)) {
      return res.status(400).json({ error: "condition must be CLOSE_ABOVE or CLOSE_BELOW" });
    }

    const date = new Date(resolveDate);
    if (Number.isNaN(date.getTime())) {
      return res.status(400).json({ error: "Invalid resolveDate" });
    }

    const market = await prisma.market.create({
      data: {
        symbol: symbol.toUpperCase(),
        strike: new Prisma.Decimal(strike),
        condition,
        resolveDate: date,
        title:
          title ||
          marketTitle(symbol.toUpperCase(), strike, condition, date),
        category: category === "SPORTS" ? "SPORTS" : "STOCK",
        description: description ? String(description).slice(0, 500) : null,
      },
    });

    res.status(201).json({ market: formatMarket(market) });

    autoInitAfterCreate(market.id).catch((e) =>
      console.warn("[solana] auto-init market:", e.message)
    );
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create market" });
  }
});

router.patch("/markets/:id/status", requireAdmin, async (req, res) => {
  const { status } = req.body;
  if (!["OPEN", "CLOSED", "RESOLVED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  const market = await prisma.market.update({
    where: { id: req.params.id },
    data: { status },
  });

  res.json({ market: formatMarket(market) });
});

router.post("/markets/resolve-due", requireAdmin, async (_req, res) => {
  try {
    await runScheduledTasks();
    const markets = await prisma.market.findMany({
      where: { status: "RESOLVED" },
      orderBy: { updatedAt: "desc" },
      take: 10,
    });
    res.json({
      success: true,
      recentlyResolved: markets.map(formatMarket),
    });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/markets/:id/resolve", requireAdmin, async (req, res) => {
  try {
    const result = await resolveMarket(req.params.id);
    const market = await prisma.market.findUnique({ where: { id: req.params.id } });
    res.json({ result, market: formatMarket(market) });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/on-chain", requireAdmin, async (_req, res) => {
  const cfg = getSolanaConfig();
  const markets = await listOnChainMarkets();
  res.json({
    configured: isProgramConfigured(),
    programId: cfg.programId || null,
    cluster: cfg.cluster,
    markets,
  });
});

router.post("/markets/:id/on-chain", requireAdmin, async (req, res) => {
  try {
    const result = await registerMarketOnChain(req.params.id);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/markets/:id/on-chain/settle", requireAdmin, async (req, res) => {
  try {
    const result = await settleMarketOnChainRecord(req.params.id, req.body?.winningOutcome);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.post("/markets/on-chain/sync-all", requireAdmin, async (_req, res) => {
  try {
    const results = await syncAllMarketsOnChain();
    res.json({ results });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message });
  }
});

router.get("/markets/:id/on-chain", requireAdmin, async (req, res) => {
  try {
    const status = await getMarketOnChainStatus(req.params.id);
    res.json(status);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
