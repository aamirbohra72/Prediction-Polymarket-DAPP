"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { MARKET_CATEGORIES } from "@/lib/categories";

export default function AdminPage() {
  const [user, setUser] = useState(null);
  const [markets, setMarkets] = useState([]);
  const [adminStats, setAdminStats] = useState(null);
  const [onChain, setOnChain] = useState(null);
  const [syncing, setSyncing] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState({
    symbol: "AAPL",
    strike: "200",
    condition: "CLOSE_ABOVE",
    resolveDate: "",
    category: "STOCK",
  });

  useEffect(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    setForm((f) => ({ ...f, resolveDate: d.toISOString().slice(0, 10) }));

    api
      .me()
      .then((d) => {
        setUser(d.user);
        if (!d.user.isAdmin) setError("Admin access required");
      })
      .catch((e) => setError(e.message));

    api.markets().then((d) => setMarkets(d.markets));
    if (localStorage.getItem("token")) {
      api.adminStats().then((d) => setAdminStats(d.stats)).catch(() => {});
      api.adminOnChain().then((d) => setOnChain(d)).catch(() => {});
    }
  }, []);

  async function refreshOnChain() {
    const d = await api.adminOnChain();
    setOnChain(d);
  }

  async function initOnChain(marketId) {
    setSyncing(marketId);
    setError("");
    try {
      await api.initMarketOnChain(marketId);
      setSuccess("Market registered on Solana devnet");
      await refreshOnChain();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(null);
    }
  }

  async function syncAllOnChain() {
    setSyncing("all");
    setError("");
    try {
      const d = await api.syncAllMarketsOnChain();
      setSuccess(`Sync done — ${d.results.filter((r) => r.status === "initialized").length} initialized`);
      await refreshOnChain();
    } catch (err) {
      setError(err.message);
    } finally {
      setSyncing(null);
    }
  }

  async function createMarket(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    try {
      await api.createMarket({
        symbol: form.symbol,
        strike: Number(form.strike),
        condition: form.condition,
        resolveDate: form.resolveDate,
        category: form.category,
      });
      setSuccess("Market created");
      const d = await api.markets();
      setMarkets(d.markets);
    } catch (err) {
      setError(err.message);
    }
  }

  async function closeMarket(id) {
    try {
      await api.closeMarket(id);
      const d = await api.markets();
      setMarkets(d.markets);
      setSuccess("Market closed");
    } catch (err) {
      setError(err.message);
    }
  }

  async function resolveMarket(id) {
    try {
      await api.resolveMarket(id);
      const d = await api.markets();
      setMarkets(d.markets);
      setSuccess("Market resolved");
    } catch (err) {
      setError(err.message);
    }
  }

  if (!user && !error) return <p className="text-[var(--muted)]">Loading…</p>;

  if (error && !user?.isAdmin) {
    return (
      <div>
        <p className="mb-4 text-red-400">{error}</p>
        <Link href="/login" className="text-[var(--accent)]">
          Log in as admin
        </Link>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Set ADMIN_EMAIL in .env to your account email to get admin access on
          register.
        </p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Admin</h1>

      {adminStats && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ["Users", adminStats.users],
            ["Markets", adminStats.markets],
            ["Open", adminStats.openMarkets],
            ["Trades", adminStats.trades],
            ["New users (7d)", adminStats.newUsersThisWeek],
          ].map(([label, val]) => (
            <div
              key={label}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-center"
            >
              <p className="text-lg font-bold">{val}</p>
              <p className="text-xs text-[var(--muted)]">{label}</p>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={createMarket}
        className="mb-10 max-w-lg space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
      >
        <h2 className="font-semibold">Create market</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Symbol</label>
            <input
              value={form.symbol}
              onChange={(e) => setForm({ ...form, symbol: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Strike ($)</label>
            <input
              type="number"
              step="0.01"
              value={form.strike}
              onChange={(e) => setForm({ ...form, strike: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Condition</label>
            <select
              value={form.condition}
              onChange={(e) => setForm({ ...form, condition: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            >
              <option value="CLOSE_ABOVE">Close above strike</option>
              <option value="CLOSE_BELOW">Close below strike</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Resolve date</label>
            <input
              type="date"
              value={form.resolveDate}
              onChange={(e) => setForm({ ...form, resolveDate: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-sm text-[var(--muted)]">Category</label>
            <select
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            >
              {MARKET_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white hover:opacity-90"
        >
          Create market
        </button>
      </form>

      {success && <p className="mb-4 text-[var(--yes)]">{success}</p>}
      {error && user?.isAdmin && <p className="mb-4 text-red-400">{error}</p>}

      <div className="mb-6 flex flex-wrap gap-3 items-center">
        <button
          type="button"
          onClick={async () => {
            try {
              await api.testEmail();
              setSuccess("Test email sent — check your inbox");
            } catch (err) {
              setError(err.message);
            }
          }}
          className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:bg-[var(--bg)]"
        >
          Send test email (Brevo)
        </button>
        <button
          type="button"
          disabled={syncing === "polymarket"}
          onClick={async () => {
            setSyncing("polymarket");
            setError("");
            try {
              const d = await api.syncPolymarket({ limit: 40 });
              const r = d.result || {};
              setSuccess(
                `Polymarket sync: +${r.created || 0} created, ${r.updated || 0} updated (seed markets untouched)`
              );
              const m = await api.markets();
              setMarkets(m.markets);
            } catch (err) {
              setError(err.message);
            } finally {
              setSyncing(null);
            }
          }}
          className="rounded-lg border border-[var(--accent)]/40 bg-[var(--accent)]/10 px-4 py-2 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 disabled:opacity-50"
        >
          {syncing === "polymarket" ? "Syncing Polymarket…" : "Sync Polymarket US (catalog)"}
        </button>
        <button
          type="button"
          onClick={async () => {
            try {
              await api.resolveDueMarkets();
              setSuccess("Ran auto close/resolve for due markets");
              const d = await api.markets();
              setMarkets(d.markets);
            } catch (err) {
              setError(err.message);
            }
          }}
          className="rounded-lg border border-amber-500/50 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:bg-amber-500/20"
        >
          Run auto close & resolve (due markets)
        </button>
      </div>

      {onChain && (
        <section className="mb-10 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold">Solana Phase 2 — On-chain markets</h2>
              <p className="text-sm text-[var(--muted)]">
                Program: {onChain.programId || "not set"} ·{" "}
                {onChain.configured ? "ready" : "needs SOLANA_PROGRAM_ID + SETTLEMENT_SECRET"}
              </p>
            </div>
            <button
              type="button"
              disabled={!onChain.configured || syncing === "all"}
              onClick={syncAllOnChain}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {syncing === "all" ? "Syncing…" : "Sync all open markets"}
            </button>
          </div>
          <div className="space-y-2 text-sm">
            {onChain.markets?.slice(0, 8).map((m) => (
              <div
                key={m.marketId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-[var(--bg)] p-3"
              >
                <span>
                  {m.symbol} · {m.synced ? "✓ on-chain" : "off-chain only"}
                  {m.pda && (
                    <span className="ml-2 text-xs text-[var(--muted)]">
                      {m.pda.slice(0, 8)}…
                    </span>
                  )}
                </span>
                {!m.synced && (
                  <button
                    type="button"
                    disabled={!onChain.configured || syncing === m.marketId}
                    onClick={() => initOnChain(m.marketId)}
                    className="text-xs text-violet-400 hover:underline disabled:opacity-50"
                  >
                    {syncing === m.marketId ? "…" : "Register on-chain"}
                  </button>
                )}
                {m.explorerUrl && (
                  <a
                    href={m.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--accent)]"
                  >
                    Solscan
                  </a>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <h2 className="mb-4 text-lg font-semibold">All markets</h2>
      <div className="space-y-3">
        {markets.map((m) => (
          <div
            key={m.id}
            className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div>
              <p className="font-medium">{m.title}</p>
              <p className="text-sm text-[var(--muted)]">
                {m.status}
                {m.winningOutcome && ` · ${m.winningOutcome} won`}
                {m.resolvedPrice != null && ` @ $${m.resolvedPrice}`}
              </p>
            </div>
            <div className="flex gap-2">
              {m.status === "OPEN" && (
                <button
                  type="button"
                  onClick={() => closeMarket(m.id)}
                  className="rounded border border-[var(--border)] px-3 py-1 text-sm hover:bg-[var(--bg)]"
                >
                  Close trading
                </button>
              )}
              {m.status !== "RESOLVED" && (
                <button
                  type="button"
                  onClick={() => resolveMarket(m.id)}
                  className="rounded bg-amber-600 px-3 py-1 text-sm text-white hover:opacity-90"
                >
                  Resolve
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
