"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import { groupMarketsIntoEvents } from "@/lib/marketEvents";
import EventMarketCard from "@/components/EventMarketCard";
import PlatformStats from "@/components/PlatformStats";
import CategorySidebar from "@/components/CategorySidebar";
import TopicPills from "@/components/TopicPills";
import FeaturedMarket from "@/components/FeaturedMarket";

const SORTS = [
  { id: "volume", label: "Volume" },
  { id: "resolveDate", label: "Resolve date" },
  { id: "yesPrice", label: "YES %" },
];

const TIMEFRAME_LABELS = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export default function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [markets, setMarkets] = useState([]);
  const [meta, setMeta] = useState(null);
  const [facets, setFacets] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [symbol, setSymbol] = useState("");
  const [sort, setSort] = useState("volume");
  const [category, setCategory] = useState("");
  const [timeframe, setTimeframe] = useState("");

  useEffect(() => {
    setSymbol(searchParams.get("symbol") || "");
    setCategory(searchParams.get("category") || "");
    setStatus(searchParams.get("status") || "");
    setTimeframe(searchParams.get("timeframe") || "");
  }, [searchParams]);

  const syncUrl = useCallback(
    (next) => {
      const params = new URLSearchParams();
      if (next.category) params.set("category", next.category);
      if (next.symbol) params.set("symbol", next.symbol);
      if (next.status) params.set("status", next.status);
      if (next.timeframe) params.set("timeframe", next.timeframe);
      const qs = params.toString();
      router.replace(qs ? `/?${qs}` : "/", { scroll: false });
    },
    [router]
  );

  const handleCategory = (id) => {
    setCategory(id);
    setStatus("");
    setSymbol("");
    // Keep timeframe when switching category (combinable); clear only on All
    const nextTf = id === "" ? "" : timeframe;
    if (id === "") setTimeframe("");
    syncUrl({ category: id, symbol: "", status: "", timeframe: nextTf });
  };

  const handleTimeframe = (id) => {
    const next = timeframe === id ? "" : id;
    setTimeframe(next);
    setStatus("");
    syncUrl({ category, symbol, status: "", timeframe: next });
  };

  const handleStatus = (id) => {
    setStatus(id);
    setCategory("");
    setSymbol("");
    setTimeframe("");
    syncUrl({ category: "", symbol: "", status: id, timeframe: "" });
  };

  const handleSymbol = (sym) => {
    setSymbol(sym);
    syncUrl({ category, symbol: sym, status, timeframe });
  };

  const load = useCallback(() => {
    setLoading(true);
    return api
      .markets({
        status: status || undefined,
        symbol: symbol || undefined,
        sort,
        category: category || undefined,
        timeframe: timeframe || undefined,
      })
      .then((d) => {
        setMarkets(d.markets);
        setMeta(d.meta || null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [status, symbol, sort, category, timeframe]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api
      .marketFacets()
      .then(setFacets)
      .catch(() => setFacets(null));
  }, [markets]);

  const events = useMemo(() => groupMarketsIntoEvents(markets), [markets]);

  const featured =
    markets.find((m) => m.status === "OPEN") || markets[0] || null;

  const title = status
    ? status === "OPEN"
      ? "Open markets"
      : status === "CLOSED"
        ? "Closing soon"
        : "Resolved"
    : [category ? categoryLabel(category) : null, timeframe ? TIMEFRAME_LABELS[timeframe] : null]
        .filter(Boolean)
        .join(" · ") || "All markets";

  const topicSymbols = (() => {
    if (!facets?.symbolsByCategory) return [];
    if (category) return facets.symbolsByCategory[category] || [];
    return Object.values(facets.symbolsByCategory)
      .flat()
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  })();

  return (
    <div>
      <PlatformStats />

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <CategorySidebar
          category={category}
          status={status}
          timeframe={timeframe}
          counts={facets?.categories || {}}
          timeframeCounts={facets?.timeframes || {}}
          total={facets?.total ?? 0}
          onCategory={handleCategory}
          onStatus={handleStatus}
          onTimeframe={handleTimeframe}
        />

        <div className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
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

          {!status && (
            <TopicPills
              category={category}
              symbol={symbol}
              symbols={topicSymbols}
              onSymbol={handleSymbol}
            />
          )}

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

              {events.length === 0 ? (
                <p className="text-[var(--muted)]">
                  No markets in this filter. Try another category or timeframe.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {events.map((ev) => (
                    <EventMarketCard key={ev.id} event={ev} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
