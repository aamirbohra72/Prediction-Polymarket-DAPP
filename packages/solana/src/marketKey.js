import crypto from "crypto";
import { PublicKey } from "@solana/web3.js";
import { getSolanaConfig } from "./config.js";

/** Deterministic 32-byte key from off-chain market id (cuid). */
export function marketKeyFromId(marketId) {
  return crypto.createHash("sha256").update(`stockpredict:market:${marketId}`).digest();
}

export function getProgramId() {
  const cfg = getSolanaConfig();
  if (!cfg.programId) {
    throw new Error("SOLANA_PROGRAM_ID is not configured — deploy program first (see onchain/README.md)");
  }
  try {
    return new PublicKey(cfg.programId);
  } catch {
    throw new Error("SOLANA_PROGRAM_ID is not a valid Solana public key");
  }
}

export function findMarketPda(marketKey) {
  const programId = getProgramId();
  const [pda, bump] = PublicKey.findProgramAddressSync(
    [Buffer.from("market"), Buffer.from(marketKey)],
    programId
  );
  return { pda, bump };
}

export function marketKeyFromIdHex(marketId) {
  return marketKeyFromId(marketId).toString("hex");
}

export function outcomeToChainByte(outcome) {
  return outcome === "YES" ? 1 : 0;
}

export function chainByteToOutcome(byte) {
  return byte === 1 ? "YES" : "NO";
}

export function isProgramConfigured() {
  const cfg = getSolanaConfig();
  return Boolean(cfg.enabled && cfg.programId && cfg.settlementSecret);
}
