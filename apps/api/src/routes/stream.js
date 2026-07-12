import { Router } from "express";
import { getOrderBookSnapshot } from "../services/orderBook.js";
import { getPriceHistory } from "../services/priceHistory.js";
import { formatMarket } from "../utils/helpers.js";
import { prisma } from "@repo/database";
import { getMarketOpenInterest } from "../services/stats.js";
import { fetchLiveQuote } from "../services/stockPrice.js";

const router = Router();

router.get("/market/:id", async (req, res) => {
  const marketId = req.params.id;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  async function push() {
    if (closed) return;
    try {
      const market = await prisma.market.findUnique({ where: { id: marketId } });
      if (!market) {
        res.write(`data: ${JSON.stringify({ error: "not found" })}\n\n`);
        return;
      }
      const book = await getOrderBookSnapshot(marketId);
      const history = await getPriceHistory(marketId, 50);
      const openInterest = await getMarketOpenInterest(marketId);
      const quote =
        market.status === "OPEN" ? await fetchLiveQuote(market.symbol) : null;

      res.write(
        `data: ${JSON.stringify({
          market: { ...formatMarket(market), ...book, openInterest, priceHistory: history, liveQuote: quote },
          at: Date.now(),
        })}\n\n`
      );
    } catch (e) {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
    }
  }

  await push();
  const interval = setInterval(push, 3000);

  req.on("close", () => clearInterval(interval));
});

export default router;
