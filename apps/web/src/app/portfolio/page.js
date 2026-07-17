"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PortfolioPage() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [positions, setPositions] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [openOrders, setOpenOrders] = useState([]);
  const [myActivity, setMyActivity] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    const [data, orders, act] = await Promise.all([
      api.portfolio(),
      api.openOrders().catch(() => ({ orders: [] })),
      api.myActivity(25).catch(() => ({ activity: [] })),
    ]);
    setUser(data.user);
    setStats(data.stats);
    setPositions(data.positions);
    setTransactions(data.transactions);
    setOpenOrders(orders.orders);
    setMyActivity(act.activity || []);
  }

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function cancelOrder(orderId) {
    try {
      await api.cancelOrder(orderId);
      await load();
    } catch (e) {
      setError(e.message);
    }
  }

  if (loading) return <p className="text-[var(--muted)]">Loading portfolio…</p>;

  if (error) {
    return (
      <div>
        <p className="mb-4 text-red-400">{error}</p>
        <Link href="/login" className="text-[var(--accent)] hover:underline">
          Log in to view portfolio
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold">Portfolio</h1>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <p className="text-sm text-[var(--muted)]">Cash balance</p>
          <p className="text-2xl font-bold">
            ${user.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
        </div>
        {stats && (
          <>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm text-[var(--muted)]">Portfolio value</p>
              <p className="text-2xl font-bold">${stats.portfolioValue.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <p className="text-sm text-[var(--muted)]">Total P&L</p>
              <p
                className={`text-2xl font-bold ${stats.totalPnl >= 0 ? "text-[var(--yes)]" : "text-[var(--no)]"}`}
              >
                {stats.totalPnl >= 0 ? "+" : ""}${stats.totalPnl.toLocaleString()}
              </p>
            </div>
          </>
        )}
      </div>

      {openOrders.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-semibold">Open orders</h2>
          <div className="space-y-3">
            {openOrders.map((o) => (
              <div
                key={o.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 text-sm"
              >
                <div>
                  <Link href={`/markets/${o.market.id}`} className="font-medium hover:text-[var(--accent)]">
                    {o.market.symbol}
                  </Link>
                  <span className="ml-2">
                    {o.side} {o.outcome} @ {o.priceCents}¢ · {o.remaining} left
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => cancelOrder(o.id)}
                  className="text-xs text-red-400 hover:underline"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-semibold">Positions</h2>
        {positions.length === 0 ? (
          <p className="text-[var(--muted)]">No open positions.</p>
        ) : (
          <div className="space-y-3">
            {positions.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4"
              >
                <Link
                  href={`/markets/${p.market.id}`}
                  className="font-medium hover:text-[var(--accent)]"
                >
                  {p.market.title}
                </Link>
                <div className="mt-2 flex flex-wrap gap-6 text-sm">
                  <span className="text-[var(--yes)]">YES: {p.yesShares}</span>
                  <span className="text-[var(--no)]">NO: {p.noShares}</span>
                  {p.markValue > 0 && (
                    <span className="text-[var(--muted)]">Mark: ${p.markValue}</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Status: {p.market.status}
                  {p.market.winningOutcome &&
                    ` · Winner: ${p.market.winningOutcome}`}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Recent transactions</h2>
        {transactions.length === 0 ? (
          <p className="text-[var(--muted)]">No transactions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[var(--surface)] text-[var(--muted)]">
                <tr>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Amount</th>
                  <th className="px-4 py-2">Balance</th>
                  <th className="px-4 py-2">Note</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-t border-[var(--border)]">
                    <td className="px-4 py-2">{t.type}</td>
                    <td
                      className={`px-4 py-2 ${
                        t.amount >= 0 ? "text-[var(--yes)]" : "text-[var(--no)]"
                      }`}
                    >
                      {t.amount >= 0 ? "+" : ""}
                      {t.amount.toFixed(2)}
                    </td>
                    <td className="px-4 py-2">{t.balanceAfter.toFixed(2)}</td>
                    <td className="px-4 py-2 text-[var(--muted)]">{t.note || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your activity</h2>
          <Link href="/activity?type=mine" className="text-sm text-[var(--accent)] hover:underline">
            Open full feed →
          </Link>
        </div>
        {myActivity.length === 0 ? (
          <p className="text-[var(--muted)]">
            No personal fills, comments, or deposits yet. Trade or comment to populate this.
          </p>
        ) : (
          <ul className="space-y-2">
            {myActivity.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-sm"
              >
                <div>
                  <span className="mr-2 text-[10px] font-semibold uppercase text-[var(--muted)]">
                    {item.type}
                  </span>
                  {item.href ? (
                    <Link href={item.href} className="hover:text-[var(--accent)]">
                      {item.text}
                    </Link>
                  ) : (
                    <span>{item.text}</span>
                  )}
                  {item.market && (
                    <span className="ml-2 text-xs text-[var(--muted)]">{item.market.symbol}</span>
                  )}
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(item.at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
