import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { prisma } = await import("@repo/database");

const email = (process.env.ADMIN_EMAIL || "").toLowerCase().trim();
if (!email) {
  console.error("ADMIN_EMAIL is not set in .env");
  process.exit(1);
}

const updated = await prisma.user.updateMany({
  where: { email },
  data: { isAdmin: true },
});

const user = await prisma.user.findUnique({
  where: { email },
  select: { email: true, isAdmin: true, id: true },
});

console.log(JSON.stringify({ email, updated: updated.count, user }, null, 2));

if (!user) {
  console.log(
    "No user with that email yet. Register or log in with that email, or use seed admin password after: npm run db:seed"
  );
}

await prisma.$disconnect();
