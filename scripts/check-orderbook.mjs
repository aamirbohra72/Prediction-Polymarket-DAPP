import dotenv from "dotenv";
dotenv.config();
import { prisma } from "@repo/database";
import { getOrderBookSnapshot } from "../../apps/api/src/services/orderBook.js";

const market = await prisma.market.findFirst({ where: { status: "OPEN" } });
if (!market) {
  console.log("no open market");
  process.exit(1);
}
const book = await getOrderBookSnapshot(market.id);
console.log(
  JSON.stringify(
    {
      market: market.title,
      yesBids: book.depth.yesBids.length,
      yesAsks: book.depth.yesAsks.length,
      spread: book.spread,
      sampleBid: book.depth.yesBids[0],
      sampleAsk: book.depth.yesAsks[0],
    },
    null,
    2
  )
);
await prisma.$disconnect();
