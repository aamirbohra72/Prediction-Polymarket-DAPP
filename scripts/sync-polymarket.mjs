/**
 * Opt-in Polymarket US catalog sync (public API — keys optional).
 * Does not modify seed/local markets (externalId = null).
 *
 * Usage: npm run sync:polymarket
 * Optional: POLYMARKET_SYNC_LIMIT=30 node scripts/sync-polymarket.mjs
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const { syncPolymarketMarkets } = await import("../apps/api/src/services/polymarketSync.js");

const limit = Number(process.env.POLYMARKET_SYNC_LIMIT) || 40;

try {
  const result = await syncPolymarketMarkets({ limit });
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
} catch (err) {
  console.error("Polymarket sync failed:", err);
  process.exit(1);
}
