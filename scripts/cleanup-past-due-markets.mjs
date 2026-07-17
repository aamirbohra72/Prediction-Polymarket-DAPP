import dotenv from "dotenv";
dotenv.config();
import { prisma } from "@repo/database";

/** Old seed markets past resolve date that spam Finnhub candle errors. */
const ids = [
  "cmpxzyawt0003jekwmsjwwj3y",
  "cmpxzyb4o0004jekwia6zahcb",
  "cmpxzyb9t0005jekwore75ymg",
];

const due = await prisma.market.findMany({
  where: {
    OR: [
      { id: { in: ids } },
      {
        status: { in: ["OPEN", "CLOSED"] },
        resolveDate: { lt: new Date() },
      },
    ],
  },
  select: { id: true, symbol: true, title: true, status: true, resolveDate: true },
});

console.log(`Deleting ${due.length} past-due market(s)…`);
for (const m of due) {
  console.log(` - ${m.symbol} ${m.status} ${m.resolveDate.toISOString().slice(0, 10)} ${m.title}`);
}

const result = await prisma.market.deleteMany({
  where: { id: { in: due.map((m) => m.id) } },
});
console.log(`Deleted ${result.count} market(s).`);
await prisma.$disconnect();
