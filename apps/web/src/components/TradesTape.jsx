"use client";

export default function TradesTape({ trades = [] }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-semibold">Recent trades</h2>
        <span className="text-xs text-[var(--muted)]">Time & sales</span>
      </div>

      {trades.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">
          No matched trades yet.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[var(--border)]">
          <div className="grid grid-cols-[1fr_1fr_1fr_1.2fr] bg-[var(--bg)] px-3 py-2 text-[11px] uppercase tracking-wide text-[var(--muted)]">
            <span>Outcome</span>
            <span className="text-right">Price</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Time</span>
          </div>
          <ul className="max-h-64 divide-y divide-[var(--border)]/70 overflow-y-auto text-sm">
            {trades.slice(0, 18).map((trade) => (
              <li key={trade.id} className="grid grid-cols-[1fr_1fr_1fr_1.2fr] px-3 py-2">
                <span className={trade.outcome === "YES" ? "text-[var(--yes)]" : "text-[var(--no)]"}>
                  {trade.outcome}
                </span>
                <span className="text-right font-medium">{trade.priceCents}¢</span>
                <span className="text-right text-[var(--muted)]">{trade.quantity}</span>
                <span className="text-right text-xs text-[var(--muted)]">
                  {new Date(trade.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
