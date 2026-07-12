import { prisma } from "@repo/database";
import { getOrderBookSnapshot } from "./orderBook.js";
import { notifyUser } from "@repo/platform/notifications";

export async function checkPriceAlerts() {
  const alerts = await prisma.priceAlert.findMany({
    where: { triggered: false },
    include: { market: true },
  });

  for (const alert of alerts) {
    if (alert.market.status !== "OPEN") continue;

    const book = await getOrderBookSnapshot(alert.marketId);
    const yesPrice = book.impliedYesPrice ?? 50;

    const hit =
      (alert.direction === "ABOVE" && yesPrice >= alert.targetCents) ||
      (alert.direction === "BELOW" && yesPrice <= alert.targetCents);

    if (!hit) continue;

    await prisma.priceAlert.update({
      where: { id: alert.id },
      data: { triggered: true },
    });

    await notifyUser(alert.userId, {
      type: "PRICE_ALERT",
      title: `Price alert: ${alert.market.symbol}`,
      body: `YES is now ${yesPrice}¢ (target ${alert.direction === "ABOVE" ? "≥" : "≤"} ${alert.targetCents}¢)`,
      marketId: alert.marketId,
    });
  }
}
