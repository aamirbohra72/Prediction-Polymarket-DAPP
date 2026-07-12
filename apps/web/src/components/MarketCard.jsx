import Link from "next/link";
import Countdown from "./Countdown";
import WatchlistStar from "./WatchlistStar";

export default function MarketCard({ market }) {
  const yesPrice = market.impliedYesPrice ?? 50;
  const spread = market.spread;

  return (
    <Link
      href={`/markets/${market.id}`}
      className="block rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5 transition hover:border-[var(--accent)]"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="rounded bg-[var(--bg)] px-2 py-0.5 text-xs font-medium text-[var(--muted)]">
          {market.symbol}
        </span>
        <div className="flex items-center gap-2">
          <WatchlistStar marketId={market.id} initial={market.watchlisted} />
          {market.status === "OPEN" && <Countdown resolveDate={market.resolveDate} />}
          <span
            className={`text-xs font-medium ${
              market.status === "OPEN"
                ? "text-[var(--yes)]"
                : market.status === "RESOLVED"
                  ? "text-[var(--muted)]"
                  : "text-amber-400"
            }`}
          >
            {market.status}
          </span>
        </div>
      </div>
      <h2 className="mb-4 text-base font-medium leading-snug">{market.title}</h2>
      <div className="mb-2 flex justify-between text-sm">
        <span className="text-[var(--yes)]">YES {yesPrice}¢</span>
        <span className="text-[var(--no)]">NO {100 - yesPrice}¢</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--bg)]">
        <div className="h-full bg-[var(--yes)]" style={{ width: `${yesPrice}%` }} />
      </div>
      <p className="mt-3 text-xs text-[var(--muted)]">
        {market.status === "RESOLVED" && market.winningOutcome
          ? `Resolved: ${market.winningOutcome} won`
          : `Vol ${market.volume ?? 0} · OI ${market.openInterest ?? 0}${spread != null ? ` · Spread ${spread}¢` : ""}`}
      </p>
    </Link>
  );
}
