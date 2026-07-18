import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { prisma } = await import("@repo/database");

const n = await prisma.market.count();
const one = await prisma.market.findFirst({ select: { id: true, symbol: true } });
console.log(JSON.stringify({ ok: true, markets: n, sample: one }, null, 2));
await prisma.$disconnect();
