import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import BN from "bn.js";
import stockpredictIdl from "./idl/stockpredict.json" with { type: "json" };
import { getConnection } from "./connection.js";
import { getSolanaConfig } from "./config.js";
import { getSettlementKeypair } from "./settlement.js";
import { explorerAddressUrl, explorerTxUrl } from "./settlement.js";
import {
  findMarketPda,
  marketKeyFromId,
  outcomeToChainByte,
  chainByteToOutcome,
  getProgramId,
} from "./marketKey.js";

export function getAnchorProgram() {
  const cfg = getSolanaConfig();
  const keypair = getSettlementKeypair();
  if (!keypair) {
    throw new Error("SOLANA_SETTLEMENT_SECRET not configured (devnet authority keypair)");
  }
  if (!cfg.programId) {
    throw new Error("SOLANA_PROGRAM_ID not configured");
  }

  const connection = getConnection();
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: cfg.commitment,
    preflightCommitment: cfg.commitment,
  });

  const idl = { ...stockpredictIdl, address: cfg.programId };
  return new Program(idl, provider);
}

export async function fetchOnChainMarketAccount(marketId) {
  const marketKey = marketKeyFromId(marketId);
  const { pda } = findMarketPda(marketKey);
  const program = getAnchorProgram();

  try {
    const account = await program.account.market.fetch(pda);
    return {
      pda: pda.toBase58(),
      programId: getProgramId().toBase58(),
      explorerUrl: explorerAddressUrl(pda.toBase58()),
      authority: account.authority.toBase58(),
      marketKeyHex: Buffer.from(account.marketKey).toString("hex"),
      strikeCents: account.strikeCents.toNumber(),
      resolveTs: account.resolveTs.toNumber(),
      status: account.status,
      statusLabel: account.status === 0 ? "OPEN" : "RESOLVED",
      winningOutcome:
        account.status === 1 ? chainByteToOutcome(account.winningOutcome) : null,
      bump: account.bump,
    };
  } catch (err) {
    if (String(err.message).includes("Account does not exist")) {
      return null;
    }
    throw err;
  }
}

export async function initializeMarketOnChain({ marketId, strike, resolveDate }) {
  const marketKey = marketKeyFromId(marketId);
  const { pda } = findMarketPda(marketKey);
  const program = getAnchorProgram();
  const cfg = getSolanaConfig();

  const existing = await fetchOnChainMarketAccount(marketId);
  if (existing) {
    return {
      alreadyExists: true,
      pda: existing.pda,
      programId: existing.programId,
      signature: null,
      explorerUrl: existing.explorerUrl,
    };
  }

  const strikeCents = Math.round(Number(strike) * 100);
  const resolveTs = Math.floor(new Date(resolveDate).getTime() / 1000);

  const signature = await program.methods
    .initializeMarket(Array.from(marketKey), new BN(strikeCents), new BN(resolveTs))
    .accounts({
      authority: program.provider.publicKey,
      market: pda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return {
    alreadyExists: false,
    pda: pda.toBase58(),
    programId: cfg.programId,
    signature,
    explorerUrl: explorerTxUrl(signature),
    strikeCents,
    resolveTs,
  };
}

export async function settleMarketOnChain({ marketId, winningOutcome }) {
  const marketKey = marketKeyFromId(marketId);
  const { pda } = findMarketPda(marketKey);
  const program = getAnchorProgram();
  const cfg = getSolanaConfig();

  const onChain = await fetchOnChainMarketAccount(marketId);
  if (!onChain) {
    throw new Error("Market not registered on-chain — run initialize first");
  }
  if (onChain.status !== 0) {
    return {
      alreadySettled: true,
      pda: onChain.pda,
      signature: null,
      explorerUrl: onChain.explorerUrl,
      winningOutcome: onChain.winningOutcome,
    };
  }

  const outcomeByte = outcomeToChainByte(winningOutcome);
  const signature = await program.methods
    .settleMarket(outcomeByte)
    .accounts({
      authority: program.provider.publicKey,
      market: pda,
    })
    .rpc();

  return {
    alreadySettled: false,
    pda: pda.toBase58(),
    programId: cfg.programId,
    signature,
    explorerUrl: explorerTxUrl(signature),
    winningOutcome,
  };
}
