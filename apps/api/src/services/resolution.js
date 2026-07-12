import { prisma, Prisma } from "@repo/database";
import { toNumber } from "../utils/helpers.js";
import { fetchDailyClose, evaluateOutcome } from "./stockPrice.js";
import { emitMarketResolved } from "./eventBus.js";
import { autoSettleAfterResolve } from "./onChainMarket.js";

export async function resolveMarket(marketId) {
  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) {
    throw new Error("Market not found");
  }
  if (market.status === "RESOLVED") {
    throw new Error("Market already resolved");
  }

  const closePrice = await fetchDailyClose(market.symbol, market.resolveDate);
  const strike = toNumber(market.strike);
  const winningOutcome = evaluateOutcome(market.condition, strike, closePrice);

  const positions = await prisma.position.findMany({
    where: { marketId },
    include: { user: true },
  });

  const payouts = [];

  await prisma.$transaction(async (tx) => {
    for (const pos of positions) {
      const winningShares =
        winningOutcome === "YES" ? pos.yesShares : pos.noShares;
      if (winningShares <= 0) continue;

      const payout = winningShares * 1;
      const user = await tx.user.findUnique({ where: { id: pos.userId } });
      const balance = toNumber(user.balance);
      const newBalance = balance + payout;

      await tx.user.update({
        where: { id: pos.userId },
        data: { balance: new Prisma.Decimal(newBalance) },
      });

      await tx.transaction.create({
        data: {
          userId: pos.userId,
          type: "RESOLUTION_PAYOUT",
          amount: new Prisma.Decimal(payout),
          balanceAfter: new Prisma.Decimal(newBalance),
          marketId,
          note: `Payout ${winningShares} ${winningOutcome} shares @ $1`,
        },
      });

      payouts.push({ userId: pos.userId, payout });
    }

    await tx.market.update({
      where: { id: marketId },
      data: {
        status: "RESOLVED",
        winningOutcome,
        resolvedPrice: new Prisma.Decimal(closePrice),
      },
    });
  });

  const resolvedMarket = await prisma.market.findUnique({ where: { id: marketId } });

  await emitMarketResolved({
    marketId,
    market: resolvedMarket,
    winningOutcome,
    closePrice,
    payouts,
  });

  const onChainSettle = await autoSettleAfterResolve(marketId, winningOutcome);

  return {
    marketId,
    closePrice,
    winningOutcome,
    strike,
    onChainSettle,
  };
}
