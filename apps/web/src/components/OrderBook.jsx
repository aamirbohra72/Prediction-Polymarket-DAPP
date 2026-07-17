import DepthChart from "./DepthChart";

function LevelRow({ level, type, maxQty, onClick }) {
  const isBid = type === "bid";
  const width = ((level.cumulativeQty ?? level.quantity) / maxQty) * 100;

  return (
    <button
      type="button"
      onClick={() => onClick?.({ priceCents: level.priceCents, side: isBid ? "SELL" : "BUY" })}
      className="relative grid w-full grid-cols-[1fr_1fr_1fr] overflow-hidden rounded px-3 py-1.5 text-left text-xs hover:bg-[var(--bg)]"
      title={isBid ? "Click to sell into this bid" : "Click to buy from this ask"}
    >
      <span
        className={`absolute inset-y-0 ${isBid ? "right-0 bg-[var(--yes)]/10" : "left-0 bg-[var(--no)]/10"}`}
        style={{ width: `${width}%` }}
      />
      <span className={`relative font-semibold ${isBid ? "text-[var(--yes)]" : "text-[var(--no)]"}`}>
        {level.priceCents}¢
      </span>
      <span className="relative text-right text-[var(--text)]">{level.quantity}</span>
      <span className="relative text-right text-[var(--muted)]">{level.cumulativeQty ?? level.quantity}</span>
    </button>
  );
}

export default function OrderBook({ depth, outcome = "YES", onLevelClick }) {
  const bids = outcome === "YES" ? depth?.yesBids ?? [] : depth?.noBids ?? [];
  const asks = outcome === "YES" ? depth?.yesAsks ?? [] : depth?.noAsks ?? [];
  const maxQty = Math.max(
    1,
    ...bids.map((l) => l.cumulativeQty ?? l.quantity),
    ...asks.map((l) => l.cumulativeQty ?? l.quantity)
  );
  const bestBid = bids[0]?.priceCents ?? null;
  const bestAsk = asks[0]?.priceCents ?? null;
  const spread = bestBid != null && bestAsk != null ? bestAsk - bestBid : null;

  return (
    <div className="space-y-4">
      <DepthChart bids={bids} asks={asks} outcome={outcome} />

      <div className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg)]">
        <div className="grid grid-cols-[1fr_1fr_1fr] border-b border-[var(--border)] px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--muted)]">
          <span>Price</span>
          <span className="text-right">Size</span>
          <span className="text-right">Total</span>
        </div>

        <div className="divide-y divide-[var(--border)]/60">
          {asks.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-[var(--muted)]">
              No asks yet — place a limit sell to add liquidity.
            </p>
          ) : (
            asks
              .slice(0, 10)
              .reverse()
              .map((level) => (
                <LevelRow key={`ask-${level.priceCents}`} level={level} type="ask" maxQty={maxQty} onClick={onLevelClick} />
              ))
          )}

          <div className="flex items-center justify-between bg-[var(--surface)] px-3 py-2 text-xs">
            <span className="text-[var(--muted)]">Spread</span>
            <span className="font-semibold">
              {spread != null ? `${spread}¢` : "—"}
              {bestBid != null && bestAsk != null && (
                <span className="ml-2 text-[var(--muted)]">
                  {bestBid}¢ / {bestAsk}¢
                </span>
              )}
            </span>
          </div>

          {bids.length === 0 ? (
            <p className="px-3 py-3 text-center text-xs text-[var(--muted)]">
              No bids yet — place a limit buy to add liquidity.
            </p>
          ) : (
            bids
              .slice(0, 10)
              .map((level) => (
                <LevelRow key={`bid-${level.priceCents}`} level={level} type="bid" maxQty={maxQty} onClick={onLevelClick} />
              ))
          )}
        </div>
      </div>

      {bids.length === 0 && asks.length === 0 && (
        <p className="text-center text-xs text-[var(--muted)]">
          Empty book — use the trade panel on the right to place limit orders and populate depth.
        </p>
      )}
    </div>
  );
}
