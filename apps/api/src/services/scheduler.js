import cron from "node-cron";
import { prisma } from "@repo/database";
import { config } from "../config.js";
import { resolveMarket } from "./resolution.js";
import { checkPriceAlerts } from "./priceAlerts.js";
import { processPendingSettlements } from "./chainSettlement.js";
import { getSolanaConfig } from "@repo/solana";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function closeDueMarkets() {
  const today = startOfDay(new Date());
  const result = await prisma.market.updateMany({
    where: {
      status: "OPEN",
      resolveDate: { lte: today },
    },
    data: { status: "CLOSED" },
  });
  if (result.count > 0) {
    console.log(`[scheduler] Closed ${result.count} market(s) past resolve date`);
  }
}

export async function resolveDueMarkets() {
  const today = startOfDay(new Date());
  const due = await prisma.market.findMany({
    where: {
      status: "CLOSED",
      resolveDate: { lt: today },
    },
  });

  for (const market of due) {
    try {
      await resolveMarket(market.id);
      console.log(`[scheduler] Resolved market ${market.id} (${market.symbol})`);
    } catch (err) {
      console.error(`[scheduler] Failed to resolve ${market.id}:`, err.message);
    }
  }
}

export async function runScheduledTasks() {
  await closeDueMarkets();
  await resolveDueMarkets();
  await checkPriceAlerts();
  const solCfg = getSolanaConfig();
  if (solCfg.enabled && solCfg.autoAttest) {
    await processPendingSettlements(15);
  }
}

export function startScheduler() {
  if (!config.enableScheduler) return;

  cron.schedule("0 * * * *", () => {
    runScheduledTasks().catch((e) => console.error("[scheduler]", e));
  });

  cron.schedule("*/5 * * * *", () => {
    checkPriceAlerts().catch((e) => console.error("[scheduler] alerts", e));
  });

  runScheduledTasks().catch((e) => console.error("[scheduler]", e));
  console.log("[scheduler] Auto close/resolve enabled (hourly)");
}
