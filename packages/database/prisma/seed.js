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

const DEMO_COMMENTS = [
  "Feels underpriced given the recent move.",
  "Going YES here — momentum looks strong.",
  "Volatility is high; waiting for a better entry.",
  "NO looks attractive at these odds.",
  "Watch the Fed print before sizing up.",
  "Already filled my limit — nice depth on this book.",
  "Anyone else seeing the same setup on the weekly?",
  "Spreads tightened a lot today.",
];

/**
 * Demo fills + discussion so /activity and market Activity panels aren't empty.
 * Creates paired FILLED orders + Trade rows (matching engine schema).
 */
async function seedActivity(markets, maker, traders) {
  const existingTrades = await prisma.trade.count();
  if (existingTrades > 0) {
    console.log(`Skipping trade seed — ${existingTrades} trades already exist.`);
  } else {
    const tradeRows = [];
    for (let i = 0; i < 60; i++) {
      const market = markets[i % markets.length];
      const buyer = traders[i % traders.length];
      const seller = i % 3 === 0 ? maker : traders[(i + 1) % traders.length];
      if (buyer.id === seller.id) continue;

      const outcome = i % 2 === 0 ? "YES" : "NO";
      const mid = 35 + (i % 30);
      const qty = 5 + (i % 20);
      const hoursAgo = 60 - i;
      const at = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);

      const buyOrder = await prisma.order.create({
        data: {
          userId: buyer.id,
          marketId: market.id,
          outcome,
          side: "BUY",
          priceCents: mid,
          quantity: qty,
          filledQty: qty,
          status: "FILLED",
          createdAt: at,
        },
      });
      const sellOrder = await prisma.order.create({
        data: {
          userId: seller.id,
          marketId: market.id,
          outcome,
          side: "SELL",
          priceCents: mid,
          quantity: qty,
          filledQty: qty,
          status: "FILLED",
          createdAt: at,
        },
      });

      tradeRows.push({
        marketId: market.id,
        buyOrderId: buyOrder.id,
        sellOrderId: sellOrder.id,
        buyerId: buyer.id,
        sellerId: seller.id,
        outcome,
        priceCents: mid,
        quantity: qty,
        createdAt: at,
      });
    }
    await prisma.trade.createMany({ data: tradeRows });
    console.log(`Seeded ${tradeRows.length} demo trades.`);
  }

  const commentCount = await prisma.marketComment.count();
  if (commentCount < 8) {
    const bodies = [];
    for (let i = 0; i < 20; i++) {
      const market = markets[i % markets.length];
      const user = traders[i % traders.length];
      const at = new Date(Date.now() - (i * 3 + 1) * 60 * 60 * 1000);
      bodies.push({
        userId: user.id,
        marketId: market.id,
        body: DEMO_COMMENTS[i % DEMO_COMMENTS.length],
        createdAt: at,
      });
    }
    await prisma.marketComment.createMany({ data: bodies });
    console.log(`Seeded ${bodies.length} demo comments.`);
  }

  // Dedicated resolved market so open books stay intact
  const resolved = await prisma.market.findFirst({
    where: { status: "RESOLVED", symbol: "DEMO" },
  });
  if (!resolved) {
    const past = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    await prisma.market.create({
      data: {
        title: "Will DEMO close above $100 on demo resolve?",
        symbol: "DEMO",
        strike: new Prisma.Decimal(100),
        condition: "CLOSE_ABOVE",
        resolveDate: past,
        status: "RESOLVED",
        winningOutcome: "YES",
        resolvedPrice: new Prisma.Decimal(112.5),
        category: "STOCK",
        description: "Seeded resolved market for Activity feed demos.",
      },
    });
    console.log("Created DEMO resolved market for activity.");
  }

  await seedSocialExtras(markets, maker, traders);
}

async function seedSocialExtras(markets, maker, traders) {
  if (!markets.length || traders.length < 2) return;

  // Whale trades (qty >= 40) for Highlights filter
  const whaleCount = await prisma.trade.count({ where: { quantity: { gte: 40 } } });
  if (whaleCount < 3) {
    for (let i = 0; i < 5; i++) {
      const market = markets[i % markets.length];
      const buyer = traders[i % traders.length];
      const seller = traders[(i + 1) % traders.length];
      const qty = 45 + i * 5;
      const at = new Date(Date.now() - i * 45 * 60 * 1000);
      const buyOrder = await prisma.order.create({
        data: {
          userId: buyer.id,
          marketId: market.id,
          outcome: "YES",
          side: "BUY",
          priceCents: 50 + i,
          quantity: qty,
          filledQty: qty,
          status: "FILLED",
          createdAt: at,
        },
      });
      const sellOrder = await prisma.order.create({
        data: {
          userId: seller.id,
          marketId: market.id,
          outcome: "YES",
          side: "SELL",
          priceCents: 50 + i,
          quantity: qty,
          filledQty: qty,
          status: "FILLED",
          createdAt: at,
        },
      });
      await prisma.trade.create({
        data: {
          marketId: market.id,
          buyOrderId: buyOrder.id,
          sellOrderId: sellOrder.id,
          buyerId: buyer.id,
          sellerId: seller.id,
          outcome: "YES",
          priceCents: 50 + i,
          quantity: qty,
          createdAt: at,
        },
      });
    }
    console.log("Seeded whale trades for Highlights.");
  }

  // Follow graph: alice → bob, bob → carol, carol → alice
  const pairs = [
    [traders[0], traders[1]],
    [traders[1], traders[2] || traders[0]],
    [traders[2] || traders[0], traders[0]],
  ];
  for (const [a, b] of pairs) {
    if (!a || !b || a.id === b.id) continue;
    await prisma.userFollow.upsert({
      where: {
        followerId_followingId: { followerId: a.id, followingId: b.id },
      },
      create: { followerId: a.id, followingId: b.id },
      update: {},
    });
  }

  // Likes + replies on existing top-level comments
  const tops = await prisma.marketComment.findMany({
    where: { parentId: null },
    take: 8,
    orderBy: { createdAt: "desc" },
  });
  for (let i = 0; i < tops.length; i++) {
    const c = tops[i];
    const liker = traders[i % traders.length];
    await prisma.commentLike.upsert({
      where: { userId_commentId: { userId: liker.id, commentId: c.id } },
      create: { userId: liker.id, commentId: c.id },
      update: {},
    });
    const replyCount = await prisma.marketComment.count({ where: { parentId: c.id } });
    if (replyCount === 0) {
      await prisma.marketComment.create({
        data: {
          userId: traders[(i + 1) % traders.length].id,
          marketId: c.marketId,
          parentId: c.id,
          body: `@${(traders[i % traders.length].displayName || "trader").replace(/\s/g, "")} agreed — watching this level.`,
          createdAt: new Date(Date.now() - i * 20 * 60 * 1000),
        },
      });
    }
  }

  // Triggered alert for activity feed
  const alertExists = await prisma.priceAlert.count({ where: { triggered: true } });
  if (alertExists === 0 && markets[0]) {
    await prisma.priceAlert.create({
      data: {
        userId: traders[0].id,
        marketId: markets[0].id,
        targetCents: 60,
        direction: "ABOVE",
        triggered: true,
      },
    });
  }

  console.log("Seeded follows, likes, replies, and triggered alert.");
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

  const traderDefs = [
    { email: "alice@example.com", displayName: "Alice", password: "demo123" },
    { email: "bob@example.com", displayName: "Bob", password: "demo123" },
    { email: "carol@example.com", displayName: "Carol", password: "demo123" },
  ];
  const traders = [];
  for (const t of traderDefs) {
    const hash = await bcrypt.hash(t.password, 10);
    const user = await prisma.user.upsert({
      where: { email: t.email },
      update: { displayName: t.displayName },
      create: {
        email: t.email,
        passwordHash: hash,
        displayName: t.displayName,
        balance: new Prisma.Decimal(10000),
      },
    });
    traders.push(user);
  }

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

  // Drop leftover past-due OPEN/CLOSED markets (they spam Finnhub resolve on startup)
  const stale = await prisma.market.deleteMany({
    where: {
      status: { in: ["OPEN", "CLOSED"] },
      resolveDate: { lt: new Date() },
      symbol: { not: "DEMO" },
    },
  });
  if (stale.count > 0) {
    console.log(`Removed ${stale.count} past-due market(s) left from older seeds.`);
  }

  // Re-open previously auto-closed demo markets that still have future resolve dates
  await prisma.market.updateMany({
    where: {
      status: "CLOSED",
      resolveDate: { gt: new Date() },
    },
    data: { status: "OPEN" },
  });

  const seededMarkets = [];
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
    seededMarkets.push(market);
  }

  await seedActivity(seededMarkets, maker, traders);

  console.log("Seed complete — markets + charts + order book + activity ready.");
  console.log(`Admin login: ${adminEmail} / admin123`);
  console.log("Demo traders: alice@example.com / bob@example.com / carol@example.com (password: demo123)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
