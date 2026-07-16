// USDC collateral vault (operator-custody model).
//
// Deposit:  user signs an SPL token transfer -> vault ATA (built on the client).
//           Backend verifies the on-chain transfer here and credits balance.
// Withdraw: backend (operator keypair) transfers from vault ATA -> user ATA.
//
// The vault is the Associated Token Account of the operator keypair
// (SOLANA_SETTLEMENT_SECRET) for the configured USDC mint. Upgrade path to a
// program-owned PDA escrow is documented in docs/WEB3-SETUP-WINDOWS.md.

import { PublicKey } from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  getOrCreateAssociatedTokenAccount,
  getAccount,
  transfer,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { getConnection } from "./connection.js";
import { getSolanaConfig } from "./config.js";
import { getSettlementKeypair } from "./settlement.js";
import { explorerTxUrl, explorerAddressUrl } from "./settlement.js";

function requireVaultSetup() {
  const cfg = getSolanaConfig();
  const payer = getSettlementKeypair();
  if (!payer) {
    throw new Error("SOLANA_SETTLEMENT_SECRET not configured (operator keypair)");
  }
  if (!cfg.usdcMint) {
    throw new Error("SOLANA_USDC_MINT not configured");
  }
  let mint;
  try {
    mint = new PublicKey(cfg.usdcMint);
  } catch {
    throw new Error(`SOLANA_USDC_MINT is not a valid public key: ${cfg.usdcMint}`);
  }
  return { cfg, payer, mint };
}

/** Convert a human amount (e.g. 10.5) to base units (BigInt) using mint decimals. */
export function toBaseUnits(amount, decimals) {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

/** Convert base units (BigInt/number/string) to a JS number using mint decimals. */
export function fromBaseUnits(baseUnits, decimals) {
  return Number(BigInt(baseUnits)) / 10 ** decimals;
}

/** Vault (operator) associated token account address + current balance. */
export async function getVaultInfo() {
  const { cfg, payer, mint } = requireVaultSetup();
  const connection = getConnection();
  const vaultAta = await getAssociatedTokenAddress(mint, payer.publicKey);

  let balance = 0;
  try {
    const acc = await getAccount(connection, vaultAta);
    balance = fromBaseUnits(acc.amount, cfg.usdcDecimals);
  } catch {
    balance = 0; // ATA not created yet
  }

  return {
    mint: mint.toBase58(),
    decimals: cfg.usdcDecimals,
    vaultAddress: vaultAta.toBase58(),
    vaultOwner: payer.publicKey.toBase58(),
    balance,
    explorerUrl: explorerAddressUrl(vaultAta.toBase58()),
  };
}

/**
 * Verify a client-submitted deposit transaction actually moved USDC into the vault.
 * Returns { amountBaseUnits, authority, slot } or throws.
 */
export async function verifyDepositTx(signature) {
  const { cfg, payer, mint } = requireVaultSetup();
  const connection = getConnection();
  const vaultAta = (await getAssociatedTokenAddress(mint, payer.publicKey)).toBase58();
  const mintStr = mint.toBase58();

  const tx = await connection.getParsedTransaction(signature, {
    commitment: cfg.commitment,
    maxSupportedTransactionVersion: 0,
  });
  if (!tx) {
    throw new Error("Transaction not found or not yet confirmed — try again in a moment");
  }
  if (tx.meta?.err) {
    throw new Error("Deposit transaction failed on-chain");
  }

  const outer = tx.transaction.message.instructions || [];
  const inner = (tx.meta?.innerInstructions || []).flatMap((i) => i.instructions);
  const all = [...outer, ...inner];

  for (const ix of all) {
    if (ix.program !== "spl-token") continue;
    const type = ix.parsed?.type;
    if (type !== "transfer" && type !== "transferChecked") continue;
    const info = ix.parsed?.info || {};
    if (info.destination !== vaultAta) continue;
    if (type === "transferChecked" && info.mint && info.mint !== mintStr) continue;

    const raw = type === "transferChecked" ? info.tokenAmount?.amount : info.amount;
    if (!raw) continue;

    return {
      amountBaseUnits: BigInt(raw),
      authority: info.authority || info.multisigAuthority || null,
      slot: tx.slot != null ? Number(tx.slot) : null,
    };
  }

  throw new Error("No USDC transfer to the vault was found in this transaction");
}

/**
 * Send USDC from the vault back to a user's wallet (withdrawal).
 * Operator keypair signs. Creates the user's ATA if needed.
 */
export async function sendWithdrawal({ toWallet, amountBaseUnits }) {
  const { payer, mint } = requireVaultSetup();
  const connection = getConnection();

  let dest;
  try {
    dest = new PublicKey(toWallet);
  } catch {
    throw new Error(`Invalid destination wallet: ${toWallet}`);
  }

  const vaultAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey
  );
  const destAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    dest
  );

  if (BigInt(vaultAccount.amount) < amountBaseUnits) {
    throw new Error("Vault has insufficient USDC to cover this withdrawal");
  }

  const signature = await transfer(
    connection,
    payer,
    vaultAccount.address,
    destAccount.address,
    payer,
    amountBaseUnits,
    [],
    undefined,
    TOKEN_PROGRAM_ID
  );

  return { signature, explorerUrl: explorerTxUrl(signature) };
}
