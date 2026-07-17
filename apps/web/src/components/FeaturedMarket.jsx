"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { categoryLabel } from "@/lib/categories";
import PriceChart from "./PriceChart";
import ChanceRing from "./ChanceRing";
import WatchlistStar from "./WatchlistStar";

export default function FeaturedMarket({ market }) {
  const [detail, setDetail] = useState(null);

  useEffect(() => {
    if (!market?.id) return;
    api.market(market.id).then((d) => setDetail(d.market)).catch(() => {});
  }, [market?.id]);

  if (!market) return null;

  const yesPrice = market.impliedYesPrice ?? 50;
  const history = detail?.priceHistory || [];
  const change =
    history.length >= 2
      ? history[history.length - 1].yesPriceCents - history[0].yesPriceCents
      : null;

  return (
    <article className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:p-6">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted)]">
        <span>
          {categoryLabel(market.category)} › {market.symbol}
        </span>
        <WatchlistStar marketId={market.id} initial={market.watchlisted} />
      </div>

      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link href={`/markets/${market.id}`}>
            <h2 className="mb-3 text-xl font-semibold leading-snug hover:text-[var(--accent)] sm:text-2xl">
              {market.title}
            </h2>
          </Link>
          {change != null && (
            <span
              className={`text-sm font-medium ${
                change >= 0 ? "text-[var(--yes)]" : "text-[var(--no)]"
              }`}
            >
              {change >= 0 ? "+" : ""}
              {change}% since chart start
            </span>
          )}
        </div>
        <ChanceRing percent={yesPrice} size={96} />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Link
          href={`/markets/${market.id}`}
          className="rounded-xl bg-[var(--yes)] py-3 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          Yes {yesPrice}¢
        </Link>
        <Link
          href={`/markets/${market.id}`}
          className="rounded-xl bg-[var(--no)] py-3 text-center text-sm font-semibold text-white hover:opacity-90"
        >
          No {100 - yesPrice}¢
        </Link>
      </div>

      <div className="mb-4 rounded-xl bg-[var(--bg)] p-3">
        <PriceChart history={history} stroke="accent" />
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-[var(--muted)]">
        <span>Vol {market.volume ?? 0}</span>
        <span>OI {market.openInterest ?? 0}</span>
        <span>Resolves {String(market.resolveDate).slice(0, 10)}</span>
        <span className={market.status === "OPEN" ? "text-[var(--yes)]" : ""}>
          {market.status}
        </span>
      </div>
    </article>
  );
}
