"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import BalanceChart from "@/components/BalanceChart";

export default function ProfilePage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    Promise.all([api.me(), api.myStats(), api.myAnalytics().catch(() => null)])
      .then(([me, st, an]) => {
        setUser(me.user);
        setDisplayName(me.user.displayName || "");
        setStats(st.stats);
        if (an) setAnalytics(an.analytics);
      })
      .catch((e) => setError(e.message));
  }, []);

  async function saveProfile(e) {
    e.preventDefault();
    setSaved(false);
    try {
      const d = await api.updateProfile({ displayName });
      setUser(d.user);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !user) {
    return (
      <p className="text-red-400">
        {error} — <a href="/login" className="text-[var(--accent)]">Log in</a>
      </p>
    );
  }

  if (!user || !stats) return <p className="text-[var(--muted)]">Loading profile…</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold">Profile</h1>

      <form onSubmit={saveProfile} className="mb-8 space-y-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            maxLength={32}
          />
        </div>
        <p className="text-sm text-[var(--muted)]">Email: {user.email}</p>
        <button type="submit" className="rounded-lg bg-[var(--accent)] px-4 py-2 text-white">
          Save
        </button>
        {saved && <p className="text-sm text-[var(--yes)]">Saved.</p>}
      </form>

      {analytics && (
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 font-semibold">Balance history</h2>
          <BalanceChart history={analytics.balanceHistory} />
        </div>
      )}

      {analytics?.exposure?.length > 0 && (
        <div className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 font-semibold">Exposure by symbol</h2>
          <ul className="space-y-2 text-sm">
            {analytics.exposure.map((e) => (
              <li key={e.symbol} className="flex justify-between">
                <span>{e.symbol}</span>
                <span className="font-medium">${e.value.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {[
          { label: "Balance", value: `$${stats.balance.toLocaleString()}` },
          { label: "Portfolio value", value: `$${stats.portfolioValue.toLocaleString()}` },
          { label: "Total P&L", value: `$${stats.totalPnl.toLocaleString()}` },
          { label: "Unrealized P&L", value: `$${stats.unrealizedPnl.toLocaleString()}` },
          { label: "Trades", value: stats.tradeCount },
          { label: "Resolved wins", value: stats.resolvedWins },
          ...(analytics?.winRate != null
            ? [{ label: "Win rate (resolved)", value: `${analytics.winRate}%` }]
            : []),
          ...(analytics
            ? [{ label: "Markets traded", value: analytics.marketsTraded }]
            : []),
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <p className="text-xs text-[var(--muted)]">{item.label}</p>
            <p className="text-xl font-bold">{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
