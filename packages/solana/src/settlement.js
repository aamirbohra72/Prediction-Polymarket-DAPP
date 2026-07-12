import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import bs58 from "bs58";
import { getConnection } from "./connection.js";
import { getSolanaConfig } from "./config.js";

/** Official Memo program — https://spl.solana.com/memo */
export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");

export function buildTradeAttestationMemo({ tradeId, marketId, outcome, priceCents, quantity }) {
  return JSON.stringify({
    app: "stockpredict",
    v: 1,
    type: "TRADE",
    tradeId,
    marketId,
    outcome,
    priceCents,
    quantity,
    at: new Date().toISOString(),
  });
}

export function getSettlementKeypair() {
  const cfg = getSolanaConfig();
  if (!cfg.settlementSecret) return null;
  try {
    const secret = bs58.decode(cfg.settlementSecret);
    return Keypair.fromSecretKey(secret);
  } catch {
    return null;
  }
}

/**
 * Submit a memo transaction attesting an off-chain trade (Phase 1 bridge).
 * Requires SOLANA_SETTLEMENT_SECRET funded on devnet.
 */
export async function submitTradeAttestation(payload) {
  const cfg = getSolanaConfig();
  const payer = getSettlementKeypair();
  if (!payer) {
    return { submitted: false, reason: "SOLANA_SETTLEMENT_SECRET not configured" };
  }

  const memo = buildTradeAttestationMemo(payload);
  const connection = getConnection();
  const ix = new TransactionInstruction({
    keys: [{ pubkey: payer.publicKey, isSigner: true, isWritable: true }],
    programId: MEMO_PROGRAM_ID,
    data: Buffer.from(memo, "utf8"),
  });

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash(cfg.commitment);
  const tx = new Transaction({
    feePayer: payer.publicKey,
    recentBlockhash: blockhash,
  }).add(
    SystemProgram.transfer({
      fromPubkey: payer.publicKey,
      toPubkey: payer.publicKey,
      lamports: 1,
    }),
    ix
  );

  tx.sign(payer);
  const signature = await connection.sendRawTransaction(tx.serialize(), {
    skipPreflight: false,
    preflightCommitment: cfg.commitment,
  });

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    cfg.commitment
  );

  const status = await connection.getSignatureStatus(signature);
  const slot = status.value?.slot ?? null;

  return {
    submitted: true,
    signature,
    slot: slot != null ? Number(slot) : null,
    explorerUrl: explorerTxUrl(signature),
    memo,
  };
}

export function explorerTxUrl(signature) {
  const cfg = getSolanaConfig();
  return `https://solscan.io/tx/${signature}${cfg.explorerCluster || ""}`;
}

export function explorerAddressUrl(address) {
  const cfg = getSolanaConfig();
  return `https://solscan.io/account/${address}${cfg.explorerCluster || ""}`;
}
