export default function OrderBook({ depth, outcome = "YES" }) {
  const bids = outcome === "YES" ? depth?.yesBids ?? [] : depth?.noBids ?? [];
  const asks = outcome === "YES" ? depth?.yesAsks ?? [] : depth?.noAsks ?? [];
  const maxQty = Math.max(
    1,
    ...bids.map((l) => l.quantity),
    ...asks.map((l) => l.quantity)
  );

  return (
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <p className="mb-2 font-medium text-[var(--yes)]">Bids</p>
        {bids.length === 0 ? (
          <p className="text-[var(--muted)]">No bids</p>
        ) : (
          <ul className="space-y-1">
            {bids.slice(0, 8).map((l) => (
              <li key={`b-${l.priceCents}`} className="flex items-center gap-2">
                <span className="w-10">{l.priceCents}¢</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-[var(--bg)]">
                  <div
                    className="h-full bg-[var(--yes)]/60"
                    style={{ width: `${(l.quantity / maxQty) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[var(--muted)]">{l.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="mb-2 font-medium text-[var(--no)]">Asks</p>
        {asks.length === 0 ? (
          <p className="text-[var(--muted)]">No asks</p>
        ) : (
          <ul className="space-y-1">
            {asks.slice(0, 8).map((l) => (
              <li key={`a-${l.priceCents}`} className="flex items-center gap-2">
                <span className="w-10">{l.priceCents}¢</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-[var(--bg)]">
                  <div
                    className="h-full bg-[var(--no)]/60"
                    style={{ width: `${(l.quantity / maxQty) * 100}%` }}
                  />
                </div>
                <span className="w-8 text-right text-[var(--muted)]">{l.quantity}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
