import { prisma } from "@repo/database";
import { sendEmailToUser } from "./email.js";

export async function notifyUser(userId, { type, title, body, marketId }) {
  const notification = await prisma.notification.create({
    data: { userId, type, title, body, marketId: marketId ?? null },
  });

  sendEmailToUser(userId, { subject: title, title, body, marketId }).catch((err) => {
    console.warn("[email] notifyUser:", err.message);
  });

  return notification;
}

export async function notifyTradeParticipants(buyerId, sellerId, market, trade) {
  const title = "Trade executed";
  const detail = `${trade.quantity} ${trade.outcome} @ ${trade.priceCents}¢ on ${market.symbol}`;

  if (buyerId !== sellerId) {
    await Promise.all([
      notifyUser(buyerId, {
        type: "TRADE_MATCH",
        title,
        body: `Bought: ${detail}`,
        marketId: market.id,
      }),
      notifyUser(sellerId, {
        type: "TRADE_MATCH",
        title,
        body: `Sold: ${detail}`,
        marketId: market.id,
      }),
    ]);
  }
}

export async function notifyMarketResolved(userId, market, payout, outcome) {
  if (payout <= 0) return;
  await notifyUser(userId, {
    type: "MARKET_RESOLVED",
    title: `${market.symbol} resolved`,
    body: `You won $${payout.toFixed(2)} on ${outcome}. Winning shares paid $1 each.`,
    marketId: market.id,
  });
}
