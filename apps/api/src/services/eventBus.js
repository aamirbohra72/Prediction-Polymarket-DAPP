import {
  TOPICS,
  EVENT_TYPES,
  isKafkaEnabled,
  publishMessage,
  isProducerReady,
} from "@repo/kafka";
import {
  invalidateAfterTrade,
  invalidateLeaderboard,
  invalidateUserCache,
} from "@repo/platform/cache";
import {
  notifyTradeParticipants,
  notifyMarketResolved,
} from "@repo/platform/notifications";
import { prisma } from "@repo/database";
import { getSolanaConfig } from "@repo/solana";
import { invalidateActivityCache } from "./activityFeed.js";
import { queueTradeAttestation, processPendingSettlements } from "./chainSettlement.js";

/**
 * Kafka OFF (default): side effects run immediately in the API.
 * Kafka ON: API publishes events; worker handles cache + notifications.
 */
export async function emitTradeExecuted(payload) {
  if (isKafkaEnabled() && isProducerReady()) {
    await publishMessage(TOPICS.TRADES, {
      key: payload.marketId,
      type: EVENT_TYPES.TRADE_EXECUTED,
      payload,
    });
    return;
  }
  const market = await prisma.market.findUnique({ where: { id: payload.marketId } });
  if (market) {
    await notifyTradeParticipants(payload.buyerId, payload.sellerId, market, payload);
  }
  await invalidateAfterTrade(payload.buyerId, payload.sellerId);
  await invalidateActivityCache();
  await queueTradeAttestation(payload).catch((e) =>
    console.warn("[solana] queue:", e.message)
  );
  if (getSolanaConfig().autoAttest) {
    processPendingSettlements(3).catch((e) =>
      console.warn("[solana] process:", e.message)
    );
  }
}

export async function emitMarketResolved(payload) {
  if (isKafkaEnabled() && isProducerReady()) {
    await publishMessage(TOPICS.MARKETS, {
      key: payload.marketId,
      type: EVENT_TYPES.MARKET_RESOLVED,
      payload,
    });
    return;
  }
  for (const p of payload.payouts || []) {
    await notifyMarketResolved(p.userId, payload.market, p.payout, payload.winningOutcome);
    await invalidateUserCache(p.userId);
  }
  await invalidateLeaderboard();
  await invalidateActivityCache();
}

export async function emitOrderPlaced(payload) {
  if (isKafkaEnabled() && isProducerReady()) {
    await publishMessage(TOPICS.TRADES, {
      key: payload.marketId,
      type: EVENT_TYPES.ORDER_PLACED,
      payload,
    });
    return;
  }
  await invalidateUserCache(payload.userId);
  await invalidateActivityCache();
}
