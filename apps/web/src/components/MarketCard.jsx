import Link from "next/link";
import ChanceRing from "./ChanceRing";
import WatchlistStar from "./WatchlistStar";
import { categoryLabel } from "@/lib/categories";
import { symbolEmoji } from "@/lib/marketEvents";

export default function MarketCard({ market }) {
  const yesPrice = market.impliedYesPrice ?? 50;

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/50 hover:bg-[var(--surface-2)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg)] text-lg">
          {symbolEmoji(market.symbol)}
        </div>
        <Link href={`/markets/${market.id}`} className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug hover:text-[var(--accent)]">
            {market.title}
          </h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {market.symbol} · {categoryLabel(market.category)}
          </p>
        </Link>
        <ChanceRing percent={yesPrice} size={64} />
      </div>

      <div className="mt-auto grid grid-cols-2 gap-2">
        <Link
          href={`/markets/${market.id}`}
          className="rounded-lg bg-[var(--yes)]/20 py-2.5 text-center text-sm font-semibold text-[var(--yes)] hover:bg-[var(--yes)] hover:text-white"
        >
          Yes
        </Link>
        <Link
          href={`/markets/${market.id}`}
          className="rounded-lg bg-[var(--no)]/20 py-2.5 text-center text-sm font-semibold text-[var(--no)] hover:bg-[var(--no)] hover:text-white"
        >
          No
        </Link>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>${((market.volume ?? 0) * (yesPrice / 100)).toFixed(0)} Vol · {market.volume ?? 0} shares</span>
        <div className="flex items-center gap-2">
          <span
            className={
              market.status === "OPEN"
                ? "text-[var(--yes)]"
                : market.status === "RESOLVED"
                  ? ""
                  : "text-amber-400"
            }
          >
            {market.status}
          </span>
          <WatchlistStar marketId={market.id} initial={market.watchlisted} />
        </div>
      </div>
    </article>
  );
}
