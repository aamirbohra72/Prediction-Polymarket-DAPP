"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function LeaderboardPage() {
  const [rows, setRows] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .leaderboard()
      .then((d) => setRows(d.leaderboard))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Leaderboard</h1>
      <p className="mb-8 text-[var(--muted)]">
        Top traders by play-money balance. Win a resolved market by holding the winning side.
      </p>

      {loading && <p className="text-[var(--muted)]">Loading…</p>}
      {error && <p className="text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="overflow-x-auto rounded-xl border border-[var(--border)]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--surface)] text-[var(--muted)]">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Trader</th>
                <th className="px-4 py-3">Balance</th>
                <th className="px-4 py-3">Trades</th>
                <th className="px-4 py-3">Wins</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.rank} className="border-t border-[var(--border)]">
                  <td className="px-4 py-3 font-medium">#{r.rank}</td>
                  <td className="px-4 py-3">{r.email}</td>
                  <td className="px-4 py-3 text-[var(--yes)]">
                    ${r.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-4 py-3">{r.tradeCount}</td>
                  <td className="px-4 py-3">{r.resolvedWins}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
