import { prisma, Prisma } from "@repo/database";
import { orderCostCents, toNumber } from "../utils/helpers.js";
import { recordPriceSnapshot } from "./priceHistory.js";
import { emitTradeExecuted } from "./eventBus.js";

async function recordTransaction(tx, userId, type, amount, balanceAfter, marketId, note) {
  await tx.transaction.create({
    data: {
      userId,
      type,
      amount: new Prisma.Decimal(amount),
      balanceAfter: new Prisma.Decimal(balanceAfter),
      marketId: marketId ?? null,
      note,
    },
  });
}

async function upsertPosition(tx, userId, marketId, outcome, delta) {
  const existing = await tx.position.findUnique({
    where: { userId_marketId: { userId, marketId } },
  });

  const yesDelta = outcome === "YES" ? delta : 0;
  const noDelta = outcome === "NO" ? delta : 0;

  if (existing) {
    return tx.position.update({
      where: { id: existing.id },
      data: {
        yesShares: existing.yesShares + yesDelta,
        noShares: existing.noShares + noDelta,
      },
    });
  }

  return tx.position.create({
    data: {
      userId,
      marketId,
      yesShares: Math.max(0, yesDelta),
      noShares: Math.max(0, noDelta),
    },
  });
}

async function executeTrade(tx, { marketId, buyOrder, sellOrder, quantity, priceCents }) {
  const cost = orderCostCents(priceCents, quantity);

  const buyer = await tx.user.findUnique({ where: { id: buyOrder.userId } });
  const seller = await tx.user.findUnique({ where: { id: sellOrder.userId } });

  const buyerBalance = toNumber(buyer.balance);
  const sellerBalance = toNumber(seller.balance);

  if (buyerBalance < cost) {
    throw new Error("Buyer has insufficient balance");
  }

  const newBuyerBalance = buyerBalance - cost;
  const newSellerBalance = sellerBalance + cost;

  await tx.user.update({
    where: { id: buyer.id },
    data: { balance: new Prisma.Decimal(newBuyerBalance) },
  });
  await tx.user.update({
    where: { id: seller.id },
    data: { balance: new Prisma.Decimal(newSellerBalance) },
  });

  await recordTransaction(
    tx,
    buyer.id,
    "TRADE_BUY",
    -cost,
    newBuyerBalance,
    marketId,
    `Bought ${quantity} ${buyOrder.outcome} @ ${priceCents}c`
  );
  await recordTransaction(
    tx,
    seller.id,
    "TRADE_SELL",
    cost,
    newSellerBalance,
    marketId,
    `Sold ${quantity} ${sellOrder.outcome} @ ${priceCents}c`
  );

  await upsertPosition(tx, buyer.id, marketId, buyOrder.outcome, quantity);
  await upsertPosition(tx, seller.id, marketId, sellOrder.outcome, -quantity);

  const trade = await tx.trade.create({
    data: {
      marketId,
      buyOrderId: buyOrder.id,
      sellOrderId: sellOrder.id,
      buyerId: buyer.id,
      sellerId: seller.id,
      outcome: buyOrder.outcome,
      priceCents,
      quantity,
    },
  });

  const updateOrderFill = async (order, fillQty) => {
    const newFilled = order.filledQty + fillQty;
    const status = newFilled >= order.quantity ? "FILLED" : "OPEN";
    return tx.order.update({
      where: { id: order.id },
      data: { filledQty: newFilled, status },
    });
  };

  await updateOrderFill(buyOrder, quantity);
  await updateOrderFill(sellOrder, quantity);
  return trade.id;
}

async function snapshotAfterTrade(marketId, priceCents, outcome) {
  const yesPrice = outcome === "YES" ? priceCents : 100 - priceCents;
  await recordPriceSnapshot(marketId, yesPrice);
}

export async function tryMatchOrder(orderId) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { market: true },
  });

  if (!order || order.status !== "OPEN" || order.market.status !== "OPEN") {
    return;
  }

  const remaining = order.quantity - order.filledQty;
  if (remaining <= 0) return;

  if (order.side === "BUY") {
    const sells = await prisma.order.findMany({
      where: {
        marketId: order.marketId,
        outcome: order.outcome,
        side: "SELL",
        status: "OPEN",
        priceCents: { lte: order.priceCents },
        id: { not: order.id },
      },
      orderBy: [{ priceCents: "asc" }, { createdAt: "asc" }],
    });

    let buyOrder = order;
    for (const sell of sells) {
      const sellRemaining = sell.quantity - sell.filledQty;
      if (sellRemaining <= 0) continue;

      const fillQty = Math.min(remaining - (buyOrder.filledQty - order.filledQty), sellRemaining);
      const actualFill = Math.min(
        buyOrder.quantity - buyOrder.filledQty,
        sell.quantity - sell.filledQty
      );
      if (actualFill <= 0) continue;

      const tradePrice = sell.priceCents;
      let tradeMeta = null;

      await prisma.$transaction(async (tx) => {
        const freshBuy = await tx.order.findUnique({ where: { id: buyOrder.id } });
        const freshSell = await tx.order.findUnique({ where: { id: sell.id } });
        const qty = Math.min(
          freshBuy.quantity - freshBuy.filledQty,
          freshSell.quantity - freshSell.filledQty
        );
        if (qty <= 0) return;

        const tradeId = await executeTrade(tx, {
          marketId: order.marketId,
          buyOrder: freshBuy,
          sellOrder: freshSell,
          quantity: qty,
          priceCents: tradePrice,
        });
        tradeMeta = {
          tradeId,
          buyerId: freshBuy.userId,
          sellerId: freshSell.userId,
          quantity: qty,
        };
      });

      if (tradeMeta) {
        await snapshotAfterTrade(order.marketId, tradePrice, order.outcome);
        await emitTradeExecuted({
          tradeId: tradeMeta.tradeId,
          marketId: order.marketId,
          buyerId: tradeMeta.buyerId,
          sellerId: tradeMeta.sellerId,
          outcome: order.outcome,
          priceCents: tradePrice,
          quantity: tradeMeta.quantity,
        });
      }

      buyOrder = await prisma.order.findUnique({ where: { id: order.id } });
      if (buyOrder.status === "FILLED") break;
    }
  } else {
    const buys = await prisma.order.findMany({
      where: {
        marketId: order.marketId,
        outcome: order.outcome,
        side: "BUY",
        status: "OPEN",
        priceCents: { gte: order.priceCents },
        id: { not: order.id },
      },
      orderBy: [{ priceCents: "desc" }, { createdAt: "asc" }],
    });

    let sellOrder = order;
    for (const buy of buys) {
      const actualFill = Math.min(
        sellOrder.quantity - sellOrder.filledQty,
        buy.quantity - buy.filledQty
      );
      if (actualFill <= 0) continue;

      const tradePrice = buy.priceCents;
      let tradeMeta = null;

      await prisma.$transaction(async (tx) => {
        const freshBuy = await tx.order.findUnique({ where: { id: buy.id } });
        const freshSell = await tx.order.findUnique({ where: { id: sellOrder.id } });
        const qty = Math.min(
          freshBuy.quantity - freshBuy.filledQty,
          freshSell.quantity - freshSell.filledQty
        );
        if (qty <= 0) return;

        const tradeId = await executeTrade(tx, {
          marketId: order.marketId,
          buyOrder: freshBuy,
          sellOrder: freshSell,
          quantity: qty,
          priceCents: tradePrice,
        });
        tradeMeta = {
          tradeId,
          buyerId: freshBuy.userId,
          sellerId: freshSell.userId,
          quantity: qty,
        };
      });

      if (tradeMeta) {
        await snapshotAfterTrade(order.marketId, tradePrice, order.outcome);
        await emitTradeExecuted({
          tradeId: tradeMeta.tradeId,
          marketId: order.marketId,
          buyerId: tradeMeta.buyerId,
          sellerId: tradeMeta.sellerId,
          outcome: order.outcome,
          priceCents: tradePrice,
          quantity: tradeMeta.quantity,
        });
      }

      sellOrder = await prisma.order.findUnique({ where: { id: order.id } });
      if (sellOrder.status === "FILLED") break;
    }
  }
}

export async function mintSharesForBuy(userId, marketId, outcome, quantity, priceCents) {
  const cost = orderCostCents(priceCents, quantity);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    const balance = toNumber(user.balance);
    if (balance < cost) {
      throw new Error("Insufficient balance");
    }

    const newBalance = balance - cost;
    await tx.user.update({
      where: { id: userId },
      data: { balance: new Prisma.Decimal(newBalance) },
    });

    await recordTransaction(
      tx,
      userId,
      "TRADE_BUY",
      -cost,
      newBalance,
      marketId,
      `Bought ${quantity} ${outcome} @ ${priceCents}c (mint)`
    );

    await upsertPosition(tx, userId, marketId, outcome, quantity);
  });

  const yesPrice = outcome === "YES" ? priceCents : 100 - priceCents;
  await recordPriceSnapshot(marketId, yesPrice);
  await emitTradeExecuted({
    marketId,
    buyerId: userId,
    sellerId: userId,
    outcome,
    priceCents,
    quantity,
  });
}

export async function releaseSharesForSell(userId, marketId, outcome, quantity, priceCents) {
  const proceeds = orderCostCents(priceCents, quantity);

  await prisma.$transaction(async (tx) => {
    const position = await tx.position.findUnique({
      where: { userId_marketId: { userId, marketId } },
    });

    const held = outcome === "YES" ? position?.yesShares ?? 0 : position?.noShares ?? 0;
    if (held < quantity) {
      throw new Error("Insufficient shares to sell");
    }

    const user = await tx.user.findUnique({ where: { id: userId } });
    const balance = toNumber(user.balance);
    const newBalance = balance + proceeds;

    await tx.user.update({
      where: { id: userId },
      data: { balance: new Prisma.Decimal(newBalance) },
    });

    await recordTransaction(
      tx,
      userId,
      "TRADE_SELL",
      proceeds,
      newBalance,
      marketId,
      `Sold ${quantity} ${outcome} @ ${priceCents}c (mint)`
    );

    await upsertPosition(tx, userId, marketId, outcome, -quantity);
  });

  const yesPrice = outcome === "YES" ? priceCents : 100 - priceCents;
  await recordPriceSnapshot(marketId, yesPrice);
  await emitTradeExecuted({
    marketId,
    buyerId: userId,
    sellerId: userId,
    outcome,
    priceCents,
    quantity,
  });
}
