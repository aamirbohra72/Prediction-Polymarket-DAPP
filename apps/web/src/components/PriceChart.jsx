"use client";

export default function PriceChart({ history = [] }) {
  if (!history.length) {
    return (
      <p className="py-8 text-center text-sm text-[var(--muted)]">
        No price history yet — trades will populate the chart.
      </p>
    );
  }

  const points = history.map((h) => h.yesPriceCents);
  const min = Math.max(1, Math.min(...points) - 5);
  const max = Math.min(99, Math.max(...points) + 5);
  const range = max - min || 1;
  const w = 400;
  const h = 120;
  const pad = 8;

  const coords = points.map((p, i) => {
    const x = pad + (i / Math.max(1, points.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (p - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const line = coords.join(" ");
  const area = `${pad},${h - pad} ${line} ${w - pad},${h - pad}`;

  return (
    <div className="w-full overflow-hidden">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" preserveAspectRatio="none">
        <defs>
          <linearGradient id="yesGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgb(34, 197, 94)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="rgb(34, 197, 94)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill="url(#yesGrad)" />
        <polyline
          points={line}
          fill="none"
          stroke="rgb(34, 197, 94)"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <div className="mt-1 flex justify-between text-xs text-[var(--muted)]">
        <span>{min}¢</span>
        <span className="text-[var(--yes)]">YES probability</span>
        <span>{max}¢</span>
      </div>
    </div>
  );
}
