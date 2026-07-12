"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import MarketCard from "@/components/MarketCard";
import PlatformStats from "@/components/PlatformStats";
import CategoryRail from "@/components/CategoryRail";
import FeaturedMarket from "@/components/FeaturedMarket";

const SORTS = [
  { id: "volume", label: "Volume" },
  { id: "resolveDate", label: "Resolve date" },
  { id: "yesPrice", label: "YES %" },
];

const TOPIC_CHIPS = [
  { label: "All", symbol: "" },
  { label: "AAPL", symbol: "AAPL" },
  { label: "TSLA", symbol: "TSLA" },
  { label: "NVDA", symbol: "NVDA" },
  { label: "MSFT", symbol: "MSFT" },
  { label: "AMZN", symbol: "AMZN" },
  { label: "GOOGL", symbol: "GOOGL" },
  { label: "META", symbol: "META" },
  { label: "AMD", symbol: "AMD" },
  { label: "SPY", symbol: "SPY" },
];

export default function HomeContent() {
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sort, setSort] = useState("volume");
  const [category, setCategory] = useState("");

  useEffect(() => {
    const s = searchParams.get("symbol");
    if (s) setSymbol(s);
  }, [searchParams]);

  const load = useCallback(() => {
    setLoading(true);
    return api
      .markets({
        status: status || undefined,
        symbol: symbol || undefined,
        sort,
        category: category || undefined,
      })
      .then((d) => {
        setMarkets(d.markets);
        setMeta(d.meta || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, symbol, sort, category]);

  useEffect(() => {
    load();
  }, [load]);

  const featured =
    markets.find((m) => m.status === "OPEN") || markets[0] || null;

  return (
    <div>
      <PlatformStats />

      <CategoryRail
        category={category}
        status={status}
        onCategory={setCategory}
        onStatus={setStatus}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold">All markets</h1>
        <div className="flex flex-wrap items-center gap-2">
          {meta?.cached && (
            <span className="rounded-full bg-[var(--accent)]/15 px-2 py-0.5 text-[10px] text-[var(--accent)]">
              Redis cache
            </span>
          )}
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs"
          >
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="category-rail mb-5 flex gap-2 overflow-x-auto pb-1">
        {TOPIC_CHIPS.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => setSymbol(t.symbol)}
            className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
              symbol === t.symbol
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && <p className="text-[var(--muted)]">Loading markets…</p>}
      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-400">
          {error}
        </p>
      )}

      {!loading && !error && (
        <div className="space-y-6">
          {featured && (
            <div className="hidden md:block">
              <FeaturedMarket market={featured} />
            </div>
          )}

          {markets.length === 0 ? (
            <p className="text-[var(--muted)]">
              No markets yet. Run <code className="text-xs">npm run db:seed</code> or create
              one in Admin.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {markets.map((m) => (
                <MarketCard key={m.id} market={m} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
