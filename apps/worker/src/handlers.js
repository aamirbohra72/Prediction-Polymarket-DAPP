import { prisma } from "@repo/database";
import { EVENT_TYPES } from "@repo/kafka";
import {
  invalidateAfterTrade,
  invalidateLeaderboard,
  invalidateUserCache,
} from "@repo/platform/cache";
import { cacheDel } from "@repo/platform/redis";
import {
  notifyTradeParticipants,
  notifyMarketResolved,
} from "@repo/platform/notifications";

export async function handleEvent(event) {
  const { type, payload } = event;

  switch (type) {
    case EVENT_TYPES.TRADE_EXECUTED:
      await handleTradeExecuted(payload);
      break;
    case EVENT_TYPES.MARKET_RESOLVED:
      await handleMarketResolved(payload);
      break;
    case EVENT_TYPES.ORDER_PLACED:
      await invalidateUserCache(payload.userId);
      break;
    default:
      console.warn("[worker] Unknown event:", type);
  }
}

async function handleTradeExecuted(payload) {
  const market = await prisma.market.findUnique({
    where: { id: payload.marketId },
  });
  if (market) {
    await notifyTradeParticipants(
      payload.buyerId,
      payload.sellerId,
      market,
      payload
    );
  }
  await invalidateAfterTrade(payload.buyerId, payload.sellerId);
  await cacheDel(
    "cache:activity:global:v1",
    "cache:activity:global:v2",
    "cache:activity:global:v3:all:40",
    "cache:activity:global:v3:all:50",
    "cache:activity:global:v3:trade:40",
    "cache:activity:global:v3:highlight:40"
  );
  console.log(
    `[worker] trade.executed ${payload.quantity} ${payload.outcome} @ ${payload.priceCents}c`
  );
}

async function handleMarketResolved(payload) {
  const market =
    payload.market ||
    (await prisma.market.findUnique({ where: { id: payload.marketId } }));

  for (const p of payload.payouts || []) {
    await notifyMarketResolved(
      p.userId,
      market,
      p.payout,
      payload.winningOutcome
    );
    await invalidateUserCache(p.userId);
  }
  await invalidateLeaderboard();
  console.log(
    `[worker] market.resolved ${payload.marketId} → ${payload.winningOutcome}`
  );
}
