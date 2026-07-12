"use client";

/** Polymarket-style circular probability ring */
export default function ChanceRing({ percent = 50, size = 72, label = "chance" }) {
  const p = Math.max(0, Math.min(100, Number(percent) || 0));
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (p / 100) * c;
  const color =
    p >= 60 ? "var(--yes)" : p <= 40 ? "var(--no)" : "var(--accent)";

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--border)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-bold leading-none" style={{ color }}>
          {Math.round(p)}%
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-wide text-[var(--muted)]">
          {label}
        </span>
      </div>
    </div>
  );
}
