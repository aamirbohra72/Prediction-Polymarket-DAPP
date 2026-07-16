// Convert a Solana CLI keypair JSON file into the base58 secret string
// used by SOLANA_SETTLEMENT_SECRET in .env.
//
// Usage:
//   node scripts/export-keypair.js "C:\\Users\\you\\.config\\solana\\operator.json"

import fs from "fs";
import bs58 from "bs58";

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/export-keypair.js "<path-to-keypair.json>"');
  process.exit(1);
}

let secret;
try {
  secret = JSON.parse(fs.readFileSync(file, "utf8"));
} catch (err) {
  console.error(`Could not read/parse keypair file: ${err.message}`);
  process.exit(1);
}

if (!Array.isArray(secret) || secret.length !== 64) {
  console.error("Expected a 64-byte JSON array (Solana CLI keypair format).");
  process.exit(1);
}

const base58 = bs58.encode(Uint8Array.from(secret));
console.log("\nSOLANA_SETTLEMENT_SECRET (base58) — copy into .env:\n");
console.log(base58);
console.log("");
