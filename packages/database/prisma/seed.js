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
  return d;
}

function marketTitle(symbol, strike, condition, resolveDate) {
  const dateStr = resolveDate.toISOString().slice(0, 10);
  const op = condition === "CLOSE_ABOVE" ? "above" : "below";
  return `Will ${symbol} close ${op} $${strike} on ${dateStr}?`;
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
    { symbol: "AAPL", strike: 200, condition: "CLOSE_ABOVE", days: 14 },
    { symbol: "TSLA", strike: 250, condition: "CLOSE_BELOW", days: 21 },
    { symbol: "NVDA", strike: 130, condition: "CLOSE_ABOVE", days: 30 },
  ];

  for (const m of demoMarkets) {
    const resolveDate = addDays(m.days);
    const title = marketTitle(m.symbol, m.strike, m.condition, resolveDate);

    const existing = await prisma.market.findFirst({
      where: { symbol: m.symbol, strike: m.strike, resolveDate },
    });

    if (!existing) {
      await prisma.market.create({
        data: {
          title,
          symbol: m.symbol,
          strike: new Prisma.Decimal(m.strike),
          condition: m.condition,
          resolveDate,
          status: "OPEN",
        },
      });
    }
  }

  console.log("Seed complete.");
  console.log(`Admin login: ${adminEmail} / admin123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
