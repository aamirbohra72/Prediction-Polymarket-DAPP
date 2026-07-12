/**
 * Windows-safe Prisma generate: clears locked engine folders and retries on EPERM.
 */
import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const schema = path.join(root, "packages/database/prisma/schema.prisma");

const pathsToClear = [
  path.join(root, "node_modules", ".prisma"),
  path.join(root, "packages", "database", "src", "generated"),
];

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function removeDir(dir) {
  if (!fs.existsSync(dir)) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
  } catch {
    /* ignore */
  }
}

async function main() {
  const maxAttempts = 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    pathsToClear.forEach(removeDir);

    try {
      execSync(`npx prisma generate --schema="${schema}"`, {
        cwd: root,
        stdio: "inherit",
        env: process.env,
      });
      console.log("\nPrisma client generated successfully.");
      return;
    } catch (err) {
      const msg = String(err.message || err);
      const isEperm = msg.includes("EPERM") || msg.includes("operation not permitted");

      if (!isEperm || attempt === maxAttempts) {
        console.error("\nPrisma generate failed.");
        if (isEperm) {
          console.error(
            "\nTip: Stop `npm run dev` and any Node API servers, then run:\n" +
              "  npm run db:generate\n"
          );
        }
        process.exit(1);
      }

      console.warn(`\nEPERM lock detected (attempt ${attempt}/${maxAttempts}). Retrying in 2s…`);
      console.warn("Close any running dev servers (npm run dev) if this keeps failing.\n");
      await sleep(2000);
    }
  }
}

main();
