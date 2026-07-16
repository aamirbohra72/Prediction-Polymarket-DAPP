"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey, Transaction } from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  getAccount,
  createTransferCheckedInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { api } from "@/lib/api";

function toBaseUnits(amount, decimals) {
  const d = Number(decimals) || 6;
  const [whole, frac = ""] = String(amount).trim().split(".");
  const fracPadded = (frac + "0".repeat(d)).slice(0, d);
  return BigInt(whole || "0") * 10n ** BigInt(d) + BigInt(fracPadded || "0");
}

function isUserRejection(err) {
  const msg = String(err?.message || err || "");
  const name = String(err?.name || "");
  return (
    /user rejected|rejected the request|cancelled|canceled/i.test(msg) ||
    name === "WalletSendTransactionError" && /reject/i.test(msg)
  );
}

export default function CollateralPanel({ walletLinked }) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [vault, setVault] = useState(null);
  const [walletUsdc, setWalletUsdc] = useState(null);
  const [walletSol, setWalletSol] = useState(null);
  const [amount, setAmount] = useState("1");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const loadVault = useCallback(async () => {
    try {
      const v = await api.solanaVault();
      setVault(v);
    } catch (e) {
      setErr(e.message);
    }
  }, []);

  useEffect(() => {
    loadVault();
  }, [loadVault]);

  const refreshWalletUsdc = useCallback(async () => {
    if (!publicKey || !vault?.mint) {
      setWalletUsdc(null);
      setWalletSol(null);
      return;
    }
    try {
      const mint = new PublicKey(vault.mint);
      const ata = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_PROGRAM_ID);
      const acc = await getAccount(connection, ata, undefined, TOKEN_PROGRAM_ID);
      setWalletUsdc(Number(acc.amount) / 10 ** (Number(vault.decimals) || 6));
    } catch {
      setWalletUsdc(0);
    }
    try {
      const lamports = await connection.getBalance(publicKey);
      setWalletSol(lamports / 1e9);
    } catch {
      setWalletSol(0);
    }
  }, [publicKey, vault, connection]);

  useEffect(() => {
    refreshWalletUsdc();
  }, [refreshWalletUsdc]);

  async function deposit() {
    setErr("");
    setMsg("");
    if (!publicKey) {
      setErr("Connect your wallet first");
      return;
    }
    if (!vault?.configured) {
      setErr("Vault not configured on the server");
      return;
    }
    const value = Number(amount);
    if (!value || value <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    if (walletUsdc != null && value > walletUsdc) {
      setErr(`Not enough wallet USDC (have ${walletUsdc.toFixed(2)})`);
      return;
    }
    if (walletSol != null && walletSol < 0.001) {
      setErr(
        "This page sees 0 SOL on Devnet. Switch Phantom → Settings → Developer Settings → Solana Devnet, then reconnect."
      );
      return;
    }

    setBusy("deposit");
    try {
      const decimals = Number(vault.decimals) || 6;
      const mint = new PublicKey(vault.mint);
      const userAta = getAssociatedTokenAddressSync(mint, publicKey, false, TOKEN_PROGRAM_ID);
      const vaultAta = new PublicKey(vault.vaultAddress);
      const baseUnits = toBaseUnits(value, decimals);

      const ix = createTransferCheckedInstruction(
        userAta,
        mint,
        vaultAta,
        publicKey,
        baseUnits,
        decimals,
        [],
        TOKEN_PROGRAM_ID
      );

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        feePayer: publicKey,
        recentBlockhash: blockhash,
      }).add(ix);

      setMsg("Approve the transfer in Phantom (network must be Devnet)…");
      const signature = await sendTransaction(tx, connection, {
        preflightCommitment: "confirmed",
      });
      setMsg("Confirming on-chain…");

      await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      const res = await api.solanaDeposit(signature);
      setMsg(
        res.alreadyProcessed
          ? "Deposit already credited"
          : `Deposited ${res.deposit.amount} USDC · balance $${res.balance}`
      );
      await Promise.all([loadVault(), refreshWalletUsdc()]);
    } catch (e) {
      if (isUserRejection(e)) {
        setErr(
          "Cancelled in Phantom. If it said “not enough SOL” or “Confirm (unsafe)”, Phantom is probably on Mainnet — switch to Devnet, reconnect, then Approve (not Cancel)."
        );
        return;
      }
      const message = String(e?.message || "Deposit failed");
      if (message.includes("BigInt")) {
        setErr("Deposit build failed — hard-refresh (Ctrl+F5) and try again.");
      } else {
        setErr(message);
      }
    } finally {
      setBusy("");
    }
  }

  async function withdraw() {
    setErr("");
    setMsg("");
    const value = Number(amount);
    if (!value || value <= 0) {
      setErr("Enter a valid amount");
      return;
    }
    setBusy("withdraw");
    try {
      const res = await api.solanaWithdraw(value);
      setMsg(`Withdrew ${res.deposit.amount} USDC · balance $${res.balance}`);
      await Promise.all([loadVault(), refreshWalletUsdc()]);
    } catch (e) {
      setErr(e.message || "Withdrawal failed");
    } finally {
      setBusy("");
    }
  }

  if (!vault) return null;

  if (!vault.configured) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-2 font-semibold">Collateral (USDC vault)</h2>
        <p className="text-sm text-[var(--muted)]">
          Not configured. Set <code className="text-xs">SOLANA_USDC_MINT</code> and{" "}
          <code className="text-xs">SOLANA_SETTLEMENT_SECRET</code> in{" "}
          <code className="text-xs">.env</code>. See{" "}
          <code className="text-xs">docs/WEB3-SETUP-WINDOWS.md</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Collateral (USDC vault)</h2>
        <a
          href={vault.vaultExplorerUrl}
          target="_blank"
          rel="noreferrer"
          className="text-xs text-[var(--accent)] hover:underline"
        >
          Vault on Solscan →
        </a>
      </div>

      <div className="mb-4 rounded-lg border border-[var(--accent)]/40 bg-[var(--bg)] p-3 text-xs leading-relaxed text-[var(--muted)]">
        <p className="font-medium text-[var(--text)]">Before depositing</p>
        <ol className="mt-1 list-decimal space-y-1 pl-4">
          <li>
            Phantom → <strong>Settings</strong> → <strong>Developer Settings</strong> → network{" "}
            <strong>Devnet</strong> (not Mainnet)
          </li>
          <li>
            Disconnect wallet here, reconnect, confirm “Wallet SOL (fees)” below is not{" "}
            <code>0</code>
          </li>
          <li>
            When Phantom opens, click <strong>Approve</strong> / <strong>Confirm</strong> — Cancel
            causes “User rejected”
          </li>
        </ol>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted)]">Your wallet USDC</p>
          <p className="text-lg font-semibold">
            {walletUsdc != null ? walletUsdc.toFixed(2) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted)]">Wallet SOL (Devnet fees)</p>
          <p className="text-lg font-semibold">
            {walletSol != null ? walletSol.toFixed(4) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-xs text-[var(--muted)]">Vault total</p>
          <p className="text-lg font-semibold">{vault.vaultBalance.toFixed(2)}</p>
        </div>
      </div>

      {walletSol != null && walletSol < 0.001 && (
        <p className="mb-3 text-xs text-[var(--no)]">
          This page sees 0 SOL on Devnet for your wallet. Switch Phantom to Devnet and reconnect.
        </p>
      )}

      {!walletLinked && (
        <p className="mb-3 text-xs text-[var(--no)]">
          Link your wallet above before depositing or withdrawing.
        </p>
      )}

      <div className="mb-3 flex gap-2">
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
          placeholder="Amount (USDC)"
        />
        <button
          type="button"
          disabled={!!busy || !walletLinked}
          onClick={() => {
            void deposit();
          }}
          className="whitespace-nowrap rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {busy === "deposit" ? "…" : "Deposit"}
        </button>
        <button
          type="button"
          disabled={!!busy || !walletLinked}
          onClick={() => {
            void withdraw();
          }}
          className="whitespace-nowrap rounded-lg border border-[var(--border)] px-4 py-2 text-sm disabled:opacity-50"
        >
          {busy === "withdraw" ? "…" : "Withdraw"}
        </button>
      </div>

      {msg && <p className="text-sm text-[var(--yes)]">{msg}</p>}
      {err && <p className="text-sm text-red-400">{err}</p>}

      {vault.deposits?.length > 0 && (
        <ul className="mt-4 space-y-2 text-sm">
          {vault.deposits.slice(0, 6).map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-[var(--border)] p-2"
            >
              <span className={d.direction === "DEPOSIT" ? "text-[var(--yes)]" : "text-[var(--no)]"}>
                {d.direction === "DEPOSIT" ? "+" : "−"}
                {d.amount} USDC
              </span>
              <a
                href={d.explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-[var(--accent)] hover:underline"
              >
                tx →
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
