import dotenv from "dotenv";
dotenv.config();
import { prisma } from "@repo/database";

try {
  const n = await prisma.market.count();
  console.log("ok markets=", n);
  const sample = await prisma.market.findFirst({
    select: { id: true, symbol: true, title: true },
  });
  console.log(sample);
  const open = await prisma.order.count({ where: { status: "OPEN" } });
  console.log("openOrders=", open);
} catch (e) {
  console.error("FAIL", e.message);
} finally {
  await prisma.$disconnect();
}
