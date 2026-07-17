import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PrismaClient, Prisma } from "../src/generated/client/index.js";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const prisma = new PrismaClient();

function addDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function marketTitle(symbol, strike, condition, resolveDate) {
  const dateStr = resolveDate.toISOString().slice(0, 10);
  const op = condition === "CLOSE_ABOVE" ? "above" : "below";
  return `Will ${symbol} close ${op} $${strike} on ${dateStr}?`;
}

async function seedPriceHistory(marketId, startCents) {
  const existing = await prisma.priceSnapshot.count({ where: { marketId } });
  if (existing > 0) return;

  let price = startCents;
  const rows = [];
  for (let i = 14; i >= 0; i--) {
    const at = new Date();
    at.setDate(at.getDate() - i);
    price = Math.max(5, Math.min(95, price + Math.round((Math.random() - 0.48) * 8)));
    rows.push({
      marketId,
      yesPriceCents: price,
      volume: Math.floor(Math.random() * 40),
      createdAt: at,
    });
  }
  await prisma.priceSnapshot.createMany({ data: rows });
}

/** Resting limit orders so the market depth chart / ladder has visible levels. */
async function seedOrderBook(marketId, midCents, makerId) {
  const openCount = await prisma.order.count({
    where: { marketId, status: "OPEN" },
  });
  if (openCount > 0) return;

  const mid = Math.max(20, Math.min(80, midCents));
  const levels = [];

  // YES bids below mid, YES asks above mid
  for (let i = 1; i <= 6; i++) {
    levels.push({
      userId: makerId,
      marketId,
      outcome: "YES",
      side: "BUY",
      priceCents: mid - i * 2,
      quantity: 15 + i * 8,
      filledQty: 0,
      status: "OPEN",
    });
    levels.push({
      userId: makerId,
      marketId,
      outcome: "YES",
      side: "SELL",
      priceCents: mid + i * 2,
      quantity: 12 + i * 7,
      filledQty: 0,
      status: "OPEN",
    });
  }

  // NO book (complementary-ish)
  for (let i = 1; i <= 4; i++) {
    levels.push({
      userId: makerId,
      marketId,
      outcome: "NO",
      side: "BUY",
      priceCents: 100 - mid - i * 2,
      quantity: 10 + i * 5,
      filledQty: 0,
      status: "OPEN",
    });
    levels.push({
      userId: makerId,
      marketId,
      outcome: "NO",
      side: "SELL",
      priceCents: 100 - mid + i * 2,
      quantity: 10 + i * 5,
      filledQty: 0,
      status: "OPEN",
    });
  }

  await prisma.order.createMany({ data: levels });

  // Give maker enough shares to cover the SELL legs
  await prisma.position.upsert({
    where: { userId_marketId: { userId: makerId, marketId } },
    update: {
      yesShares: { increment: 500 },
      noShares: { increment: 500 },
    },
    create: {
      userId: makerId,
      marketId,
      yesShares: 500,
      noShares: 500,
    },
  });
}

async function main() {
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@example.com").toLowerCase();
  const passwordHash = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { isAdmin: true, passwordHash },
    create: {
      email: adminEmail,
      passwordHash,
      isAdmin: true,
      balance: new Prisma.Decimal(10000),
    },
  });

  const makerHash = await bcrypt.hash("maker123", 10);
  const maker = await prisma.user.upsert({
    where: { email: "marketmaker@example.com" },
    update: { balance: new Prisma.Decimal(50000) },
    create: {
      email: "marketmaker@example.com",
      passwordHash: makerHash,
      displayName: "Market Maker",
      balance: new Prisma.Decimal(50000),
    },
  });

  const txCount = await prisma.transaction.count({ where: { userId: admin.id } });
  if (txCount === 0) {
    await prisma.transaction.create({
      data: {
        userId: admin.id,
        type: "DEPOSIT_INITIAL",
        amount: new Prisma.Decimal(10000),
        balanceAfter: new Prisma.Decimal(10000),
        note: "Seed welcome bonus",
      },
    });
  }

  const demoMarkets = [
    { symbol: "AAPL", strike: 200, condition: "CLOSE_ABOVE", days: 14, start: 55 },
    { symbol: "AAPL", strike: 220, condition: "CLOSE_ABOVE", days: 45, start: 32 },
    { symbol: "TSLA", strike: 250, condition: "CLOSE_BELOW", days: 21, start: 48 },
    { symbol: "TSLA", strike: 300, condition: "CLOSE_ABOVE", days: 60, start: 28 },
    { symbol: "NVDA", strike: 130, condition: "CLOSE_ABOVE", days: 30, start: 62 },
    { symbol: "NVDA", strike: 150, condition: "CLOSE_ABOVE", days: 50, start: 41 },
    { symbol: "MSFT", strike: 420, condition: "CLOSE_ABOVE", days: 20, start: 52 },
    { symbol: "AMZN", strike: 200, condition: "CLOSE_ABOVE", days: 25, start: 57 },
    { symbol: "GOOGL", strike: 180, condition: "CLOSE_ABOVE", days: 35, start: 49 },
    { symbol: "META", strike: 550, condition: "CLOSE_ABOVE", days: 28, start: 44 },
    { symbol: "AMD", strike: 160, condition: "CLOSE_BELOW", days: 18, start: 38 },
    { symbol: "NFLX", strike: 900, condition: "CLOSE_ABOVE", days: 40, start: 33 },
    { symbol: "SPY", strike: 550, condition: "CLOSE_ABOVE", days: 15, start: 61 },
    { symbol: "SPY", strike: 500, condition: "CLOSE_BELOW", days: 45, start: 22 },
  ];

  // Re-open previously auto-closed demo markets that still have future resolve dates
  await prisma.market.updateMany({
    where: {
      status: "CLOSED",
      resolveDate: { gt: new Date() },
    },
    data: { status: "OPEN" },
  });

  for (const m of demoMarkets) {
    const resolveDate = addDays(m.days);
    const title = marketTitle(m.symbol, m.strike, m.condition, resolveDate);

    let market = await prisma.market.findFirst({
      where: { symbol: m.symbol, strike: m.strike, title },
    });

    if (!market) {
      market = await prisma.market.findFirst({
        where: {
          symbol: m.symbol,
          strike: new Prisma.Decimal(m.strike),
          status: { in: ["OPEN", "CLOSED"] },
        },
      });
    }

    if (!market) {
      market = await prisma.market.create({
        data: {
          title,
          symbol: m.symbol,
          strike: new Prisma.Decimal(m.strike),
          condition: m.condition,
          resolveDate,
          status: "OPEN",
          category: "STOCK",
          description: `Play-money prediction on ${m.symbol} daily close vs $${m.strike}.`,
        },
      });
      console.log("Created", market.symbol, market.title);
    } else if (market.status !== "OPEN" && new Date(market.resolveDate) > new Date()) {
      market = await prisma.market.update({
        where: { id: market.id },
        data: { status: "OPEN", resolveDate },
      });
    }

    await seedPriceHistory(market.id, m.start);
    await seedOrderBook(market.id, m.start, maker.id);
  }

  console.log("Seed complete — markets + chart history + order book depth ready.");
  console.log(`Admin login: ${adminEmail} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
