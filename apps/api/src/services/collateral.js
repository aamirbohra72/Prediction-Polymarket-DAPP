import { prisma } from "@repo/database";
import {
  getVaultInfo,
  verifyDepositTx,
  sendWithdrawal,
  getSolanaConfig,
  isCollateralConfigured,
} from "@repo/solana";

// 1 USDC (on-chain) credits $1 of tradeable play-money balance.
function roundMoney(n) {
  return Math.round(n * 100) / 100;
}

function fromBaseUnits(baseUnits, decimals) {
  return Number(BigInt(baseUnits)) / 10 ** decimals;
}

function toBaseUnits(amount, decimals) {
  const [whole, frac = ""] = String(amount).split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0");
}

export function formatDeposit(row) {
  return {
    id: row.id,
    direction: row.direction,
    amount: Number(row.amount),
    walletAddress: row.walletAddress,
    txSignature: row.txSignature,
    status: row.status,
    createdAt: row.createdAt,
    explorerUrl: `https://solscan.io/tx/${row.txSignature}${
      getSolanaConfig().explorerCluster || ""
    }`,
  };
}

export async function getCollateralOverview(userId) {
  const configured = isCollateralConfigured();
  const cfg = getSolanaConfig();
  const base = {
    configured,
    mint: cfg.usdcMint || null,
    decimals: cfg.usdcDecimals,
  };

  if (!configured) {
    return { ...base, vaultAddress: null, vaultBalance: 0, deposits: [] };
  }

  const vault = await getVaultInfo();
  const deposits = userId
    ? await prisma.walletDeposit.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 25,
      })
    : [];

  return {
    ...base,
    vaultAddress: vault.vaultAddress,
    vaultOwner: vault.vaultOwner,
    vaultBalance: vault.balance,
    vaultExplorerUrl: vault.explorerUrl,
    deposits: deposits.map(formatDeposit),
  };
}

/**
 * Confirm a client-signed deposit transaction and credit the user's balance.
 * Idempotent by txSignature.
 */
export async function confirmDeposit({ userId, walletAddress, signature }) {
  if (!isCollateralConfigured()) {
    throw new Error("Collateral vault not configured");
  }
  if (!signature) throw new Error("Transaction signature required");
  if (!walletAddress) throw new Error("Link a wallet before depositing");

  const existing = await prisma.walletDeposit.findUnique({
    where: { txSignature: signature },
  });
  if (existing) {
    return { alreadyProcessed: true, deposit: formatDeposit(existing) };
  }

  const cfg = getSolanaConfig();
  const { amountBaseUnits, authority, slot } = await verifyDepositTx(signature);

  if (authority && authority !== walletAddress) {
    throw new Error("Deposit was not signed by your linked wallet");
  }
  if (amountBaseUnits <= 0n) {
    throw new Error("Deposit amount must be greater than zero");
  }

  const amount = fromBaseUnits(amountBaseUnits, cfg.usdcDecimals);
  const credit = roundMoney(amount);

  const result = await prisma.$transaction(async (tx) => {
    const deposit = await tx.walletDeposit.create({
      data: {
        userId,
        direction: "DEPOSIT",
        amount,
        walletAddress,
        mint: cfg.usdcMint,
        txSignature: signature,
        slot: slot != null ? BigInt(slot) : null,
        status: "CONFIRMED",
      },
    });
    const user = await tx.user.update({
      where: { id: userId },
      data: { balance: { increment: credit } },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "WALLET_DEPOSIT",
        amount: credit,
        balanceAfter: user.balance,
        note: `On-chain USDC deposit ${signature.slice(0, 8)}…`,
      },
    });
    return { deposit, balance: Number(user.balance) };
  });

  return {
    alreadyProcessed: false,
    deposit: formatDeposit(result.deposit),
    balance: result.balance,
  };
}

/**
 * Debit the user's balance and send USDC from the vault back to their wallet.
 */
export async function processWithdrawal({ userId, walletAddress, amount }) {
  if (!isCollateralConfigured()) {
    throw new Error("Collateral vault not configured");
  }
  if (!walletAddress) throw new Error("Link a wallet before withdrawing");

  const value = roundMoney(Number(amount));
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("Withdrawal amount must be greater than zero");
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (Number(user.balance) < value) {
    throw new Error("Insufficient balance for this withdrawal");
  }

  const cfg = getSolanaConfig();
  const amountBaseUnits = toBaseUnits(value.toFixed(cfg.usdcDecimals), cfg.usdcDecimals);

  // Send on-chain first; only debit if it succeeds.
  const { signature, explorerUrl } = await sendWithdrawal({
    toWallet: walletAddress,
    amountBaseUnits,
  });

  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { balance: { decrement: value } },
    });
    const deposit = await tx.walletDeposit.create({
      data: {
        userId,
        direction: "WITHDRAWAL",
        amount: value,
        walletAddress,
        mint: cfg.usdcMint,
        txSignature: signature,
        status: "CONFIRMED",
      },
    });
    await tx.transaction.create({
      data: {
        userId,
        type: "WALLET_WITHDRAWAL",
        amount: -value,
        balanceAfter: updated.balance,
        note: `On-chain USDC withdrawal ${signature.slice(0, 8)}…`,
      },
    });
    return { deposit, balance: Number(updated.balance) };
  });

  return {
    deposit: formatDeposit(result.deposit),
    balance: result.balance,
    explorerUrl,
  };
}
