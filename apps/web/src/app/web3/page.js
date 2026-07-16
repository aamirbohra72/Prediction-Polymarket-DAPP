"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { api } from "@/lib/api";
import WalletConnectButton from "@/components/WalletConnectButton";
import CollateralPanel from "@/components/CollateralPanel";

export default function Web3Page() {
  const { connection } = useConnection();
  const { publicKey, signMessage, connected } = useWallet();
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(null);
  const [health, setHealth] = useState(null);
  const [settlements, setSettlements] = useState([]);
  const [chainMarkets, setChainMarkets] = useState([]);
  const [balance, setBalance] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [linking, setLinking] = useState(false);

  const load = useCallback(async () => {
    const [cfg, h, me, st, cm] = await Promise.all([
      api.solanaConfig().catch(() => null),
      api.solanaHealth().catch(() => null),
      api.me().catch(() => null),
      api.solanaSettlements().catch(() => ({ settlements: [] })),
      api.solanaMarkets().catch(() => ({ markets: [] })),
    ]);
    setConfig(cfg);
    setHealth(h);
    if (me) setUser(me.user);
    setSettlements(st.settlements || []);
    setChainMarkets(cm.markets || []);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    connection.getBalance(publicKey).then((lamports) => {
      setBalance(lamports / 1e9);
    });
  }, [publicKey, connection]);

  async function linkWallet() {
    if (!publicKey || !signMessage) {
      setError("Connect a wallet that supports signMessage");
      return;
    }
    setLinking(true);
    setError("");
    setSuccess("");
    try {
      const { message } = await api.solanaLinkMessage();
      const encoded = new TextEncoder().encode(message);
      const sig = await signMessage(encoded);
      const res = await api.solanaLinkWallet({
        publicKey: publicKey.toBase58(),
        signature: bs58.encode(sig),
        message,
      });
      setUser(res.user);
      setSuccess("Wallet linked to your account");
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setLinking(false);
    }
  }

  async function unlinkWallet() {
    try {
      const res = await api.solanaUnlinkWallet();
      setUser(res.user);
      setSuccess("Wallet unlinked");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!config?.enabled) {
    return (
      <div className="max-w-xl">
        <h1 className="mb-4 text-2xl font-bold">Web3 / Solana</h1>
        <p className="text-[var(--muted)]">
          Solana is disabled. Set <code className="text-sm">SOLANA_ENABLED=true</code> in{" "}
          <code className="text-sm">.env</code> and restart the API.
        </p>
        <p className="mt-4 text-sm text-[var(--muted)]">
          See <code className="text-xs">docs/SOLANA-ROADMAP.md</code> in the repo.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Web3 — Solana</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Devnet integration ·{" "}
        <a
          href="https://solana.com/docs/intro/quick-start"
          className="text-[var(--accent)] hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Solana docs
        </a>
      </p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      {success && <p className="mb-4 text-sm text-[var(--yes)]">{success}</p>}

      <div className="mb-6 flex flex-wrap items-center gap-4">
        <WalletConnectButton />
        {!user && (
          <Link href="/login" className="text-sm text-[var(--accent)]">
            Log in to link wallet
          </Link>
        )}
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <Stat label="Cluster" value={config.cluster} />
        <Stat label="RPC" value={health?.ok ? "Connected" : "Error"} />
        <Stat label="Slot" value={health?.slot ?? "—"} />
        <Stat
          label="Program"
          value={config.programConfigured ? "Configured" : "Not deployed"}
        />
        <Stat label="Wallet SOL" value={balance != null ? `${balance.toFixed(4)} SOL` : "—"} />
      </div>

      {config.programId && (
        <p className="mb-6 truncate text-xs text-[var(--muted)]">
          Program ID: {config.programId}
        </p>
      )}

      <section className="mb-8">
        <h2 className="mb-3 font-semibold">On-chain markets (Phase 2)</h2>
        {chainMarkets.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No markets or program not deployed.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {chainMarkets.filter((m) => m.synced).slice(0, 10).map((m) => (
              <li
                key={m.marketId}
                className="flex flex-wrap justify-between gap-2 rounded-lg border border-[var(--border)] p-3"
              >
                <Link href={`/markets/${m.marketId}`} className="font-medium hover:text-[var(--accent)]">
                  {m.symbol}
                </Link>
                <span className="text-[var(--yes)]">on-chain</span>
                {m.explorerUrl && (
                  <a href={m.explorerUrl} target="_blank" rel="noreferrer" className="text-[var(--accent)]">
                    PDA →
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {user && connected && (
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-3 font-semibold">Link wallet to account</h2>
          <p className="mb-3 text-sm text-[var(--muted)]">
            Linked: {user.walletAddress || "None"}
          </p>
          {user.walletAddress === publicKey?.toBase58() ? (
            <button
              type="button"
              onClick={unlinkWallet}
              className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm"
            >
              Unlink wallet
            </button>
          ) : (
            <button
              type="button"
              disabled={linking}
              onClick={linkWallet}
              className="rounded-lg bg-[var(--accent)] px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {linking ? "Signing…" : "Sign & link wallet"}
            </button>
          )}
        </div>
      )}

      {user && connected && (
        <div className="mb-8">
          <CollateralPanel
            walletLinked={user.walletAddress === publicKey?.toBase58()}
          />
        </div>
      )}

      <section>
        <h2 className="mb-4 font-semibold">On-chain settlements</h2>
        <p className="mb-4 text-sm text-[var(--muted)]">
          Trades are attested on devnet via Memo program when{" "}
          <code className="text-xs">SOLANA_AUTO_ATTEST=true</code>.
        </p>
        {settlements.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No settlements yet — place a matched trade.</p>
        ) : (
          <ul className="space-y-3">
            {settlements.map((s) => (
              <li
                key={s.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
              >
                <div className="flex flex-wrap justify-between gap-2">
                  <span>
                    {s.type} · <span className="text-[var(--muted)]">{s.status}</span>
                  </span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                {s.explorerUrl && (
                  <a
                    href={s.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block text-[var(--accent)] hover:underline"
                  >
                    View on Solscan →
                  </a>
                )}
                {s.error && <p className="mt-1 text-xs text-red-400">{s.error}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className="truncate text-lg font-semibold">{value}</p>
    </div>
  );
}
