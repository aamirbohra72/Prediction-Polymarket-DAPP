import Link from "next/link";
import WatchlistStar from "./WatchlistStar";
import { categoryLabel } from "@/lib/categories";
import {
  symbolEmoji,
  formatStrike,
  timeframeLabelForDate,
} from "@/lib/marketEvents";

/** Polymarket-style card: one question, multiple strike / Yes-No rows. */
export default function EventMarketCard({ event }) {
  const markets = event.markets || [];
  const primary = markets[0];
  const volUsd = markets.reduce(
    (sum, m) => sum + (m.volume ?? 0) * ((m.impliedYesPrice ?? 50) / 100),
    0
  );
  const timeframe =
    event.timeframeLabel || timeframeLabelForDate(event.resolveDate);

  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40 hover:bg-[var(--surface-2)]">
      <div className="mb-3 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--bg)] text-lg">
          {symbolEmoji(event.symbol)}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="line-clamp-2 text-sm font-semibold leading-snug">
            {event.title}
          </h2>
          <p className="mt-1 text-[11px] text-[var(--muted)]">
            {event.externalSource === "POLYMARKET_US" ? "Polymarket US · " : ""}
            {event.symbol} · {categoryLabel(event.category)}
          </p>
        </div>
        {primary && (
          <WatchlistStar
            marketId={primary.id}
            initial={primary.watchlisted}
          />
        )}
      </div>

      <ul className="flex flex-1 flex-col gap-2">
        {markets.slice(0, 4).map((m) => {
          const pct = Math.round(m.impliedYesPrice ?? 50);
          return (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg bg-[var(--bg)]/60 px-2 py-1.5"
            >
              <Link
                href={`/markets/${m.id}`}
                className="min-w-[4.5rem] shrink-0 text-sm font-medium hover:text-[var(--accent)]"
              >
                {formatStrike(m.strike, m.condition)}
              </Link>
              <span className="w-10 shrink-0 text-right text-sm tabular-nums text-[var(--muted)]">
                {pct}%
              </span>
              <div className="ml-auto flex gap-1.5">
                <Link
                  href={`/markets/${m.id}`}
                  className="rounded-md bg-[var(--yes)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--yes)] hover:bg-[var(--yes)] hover:text-white"
                >
                  Yes
                </Link>
                <Link
                  href={`/markets/${m.id}`}
                  className="rounded-md bg-[var(--no)]/20 px-2.5 py-1 text-xs font-semibold text-[var(--no)] hover:bg-[var(--no)] hover:text-white"
                >
                  No
                </Link>
              </div>
            </li>
          );
        })}
        {markets.length > 4 && (
          <li className="px-1 text-[11px] text-[var(--muted)]">
            +{markets.length - 4} more targets
          </li>
        )}
      </ul>

      <div className="mt-3 flex items-center justify-between text-[11px] text-[var(--muted)]">
        <span>
          ${volUsd >= 1000 ? `${(volUsd / 1000).toFixed(1)}K` : volUsd.toFixed(0)}{" "}
          Vol.
        </span>
        <span>{timeframe}</span>
      </div>
    </article>
  );
}
