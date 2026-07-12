"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import MarketCard from "@/components/MarketCard";
import PlatformStats from "@/components/PlatformStats";

const TABS = [
  { id: "", label: "All" },
  { id: "OPEN", label: "Open" },
  { id: "CLOSED", label: "Closing" },
  { id: "RESOLVED", label: "Resolved" },
];

const SORTS = [
  { id: "resolveDate", label: "Resolve date" },
  { id: "volume", label: "Volume" },
  { id: "yesPrice", label: "YES price" },
];

export default function HomePage() {
  const [markets, setMarkets] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sort, setSort] = useState("resolveDate");
  const [category, setCategory] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    return api
      .markets({
        status: status || undefined,
        symbol: symbol || undefined,
        sort,
        category: category || undefined,
      })
      .then((d) => setMarkets(d.markets))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, symbol, sort, category]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="mb-2 text-3xl font-bold">Stock prediction markets</h1>
        <p className="max-w-2xl text-[var(--muted)]">
          Live order books, price alerts, watchlists, and real-time stock quotes — all
          with play money.
        </p>
      </div>

      <PlatformStats />

      <div className="mb-4 flex flex-wrap gap-4">
        <input
          type="search"
          placeholder="Search symbol (e.g. AAPL)"
          value={symbol}
          onChange={(e) => setSymbol(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          <option value="">All categories</option>
          <option value="STOCK">Stocks</option>
          <option value="SPORTS">Sports (soon)</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
        >
          {SORTS.map((s) => (
            <option key={s.id} value={s.id}>
              Sort: {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setStatus(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm ${
              status === t.id
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-[var(--muted)]">Loading markets…</p>}
      {error && <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">{error}</p>}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2">
          {markets.length === 0 ? (
            <p className="text-[var(--muted)]">No markets match your filters.</p>
          ) : (
            markets.map((m) => <MarketCard key={m.id} market={m} />)
          )}
        </div>
      )}
    </div>
  );
}
