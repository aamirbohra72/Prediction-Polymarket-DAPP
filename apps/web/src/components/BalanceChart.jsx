"use client";

export default function BalanceChart({ history }) {
  if (!history?.length) {
    return <p className="text-sm text-[var(--muted)]">No balance history yet — make a trade to see your chart.</p>;
  }

  const values = history.map((h) => h.balance);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 10000);
  const range = max - min || 1;
  const w = 100;
  const h = 48;
  const step = history.length > 1 ? w / (history.length - 1) : w;

  const points = history
    .map((pt, i) => {
      const x = i * step;
      const y = h - ((pt.balance - min) / range) * (h - 4) - 2;
      return `${x},${y}`;
    })
    .join(" ");

  const last = history[history.length - 1];
  const first = history[0];
  const change = last.balance - first.balance;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full text-[var(--accent)]" preserveAspectRatio="none">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
          points={points}
        />
      </svg>
      <div className="mt-2 flex justify-between text-xs text-[var(--muted)]">
        <span>{new Date(first.at).toLocaleDateString()}</span>
        <span className={change >= 0 ? "text-[var(--yes)]" : "text-[var(--no)]"}>
          {change >= 0 ? "+" : ""}${change.toFixed(2)} since start
        </span>
        <span>{new Date(last.at).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
