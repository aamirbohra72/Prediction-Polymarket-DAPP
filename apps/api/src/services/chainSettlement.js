import { prisma } from "@repo/database";
import {
  getSolanaConfig,
  submitTradeAttestation,
  explorerTxUrl,
} from "@repo/solana";

export async function queueTradeAttestation(payload) {
  const cfg = getSolanaConfig();
  if (!cfg.enabled || !payload.tradeId) return null;

  const existing = await prisma.chainSettlement.findFirst({
    where: { tradeId: payload.tradeId, type: "TRADE_ATTESTATION" },
  });
  if (existing) return existing;

  return prisma.chainSettlement.create({
    data: {
      tradeId: payload.tradeId,
      marketId: payload.marketId,
      userId: payload.buyerId,
      type: "TRADE_ATTESTATION",
      status: cfg.autoAttest && cfg.settlementSecret ? "PENDING" : "SKIPPED",
      payload: {
        buyerId: payload.buyerId,
        sellerId: payload.sellerId,
        outcome: payload.outcome,
        priceCents: payload.priceCents,
        quantity: payload.quantity,
      },
    },
  });
}

export async function processPendingSettlements(limit = 10) {
  const cfg = getSolanaConfig();
  if (!cfg.enabled || !cfg.autoAttest || !cfg.settlementSecret) return { processed: 0 };

  const pending = await prisma.chainSettlement.findMany({
    where: { status: "PENDING", type: "TRADE_ATTESTATION" },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  let processed = 0;
  for (const row of pending) {
    try {
      const payload = row.payload;
      const result = await submitTradeAttestation({
        tradeId: row.tradeId,
        marketId: row.marketId,
        outcome: payload.outcome,
        priceCents: payload.priceCents,
        quantity: payload.quantity,
      });

      if (!result.submitted) {
        await prisma.chainSettlement.update({
          where: { id: row.id },
          data: { status: "FAILED", error: result.reason },
        });
        continue;
      }

      await prisma.chainSettlement.update({
        where: { id: row.id },
        data: {
          status: "CONFIRMED",
          txSignature: result.signature,
          slot: result.slot != null ? BigInt(result.slot) : null,
        },
      });
      processed += 1;
    } catch (err) {
      await prisma.chainSettlement.update({
        where: { id: row.id },
        data: { status: "FAILED", error: err.message },
      });
    }
  }

  return { processed };
}

export function formatSettlement(row) {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    tradeId: row.tradeId,
    marketId: row.marketId,
    txSignature: row.txSignature,
    explorerUrl: row.txSignature ? explorerTxUrl(row.txSignature) : null,
    payload: row.payload,
    error: row.error,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
