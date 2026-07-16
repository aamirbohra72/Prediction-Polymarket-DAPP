import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
dotenv.config({ path: path.join(root, ".env") });

const CLUSTERS = {
  devnet: "https://api.devnet.solana.com",
  testnet: "https://api.testnet.solana.com",
  mainnet: "https://api.mainnet-beta.solana.com",
};

export function getSolanaConfig() {
  const cluster = process.env.SOLANA_CLUSTER || "devnet";
  const rpcUrl =
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
    CLUSTERS[cluster] ||
    CLUSTERS.devnet;

  return {
    enabled: process.env.SOLANA_ENABLED === "true",
    cluster,
    rpcUrl,
    programId: process.env.SOLANA_PROGRAM_ID || "",
    autoAttest: process.env.SOLANA_AUTO_ATTEST === "true",
    autoSettle: process.env.SOLANA_AUTO_SETTLE === "true",
    autoInitMarkets: process.env.SOLANA_AUTO_INIT_MARKETS === "true",
    settlementSecret: process.env.SOLANA_SETTLEMENT_SECRET || "",
    commitment: process.env.SOLANA_COMMITMENT || "confirmed",
    explorerCluster: cluster === "mainnet" ? "" : `?cluster=${cluster}`,
    usdcMint: process.env.SOLANA_USDC_MINT || "",
    usdcDecimals: Number(process.env.SOLANA_USDC_DECIMALS || 6),
  };
}

// Collateral (USDC vault) is usable only when the token mint + operator key exist.
export function isCollateralConfigured() {
  const cfg = getSolanaConfig();
  return Boolean(cfg.enabled && cfg.usdcMint && cfg.settlementSecret);
}
