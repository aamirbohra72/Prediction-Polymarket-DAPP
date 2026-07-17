"use client";

function pointsForDepth(levels, side, w, h, pad, maxQty) {
  if (!levels.length) return [];

  const half = (w - pad * 2) / 2;
  const center = w / 2;
  const ordered = side === "bid" ? [...levels].reverse() : levels;

  return ordered.map((level, i) => {
    const ratio = ordered.length === 1 ? 1 : i / (ordered.length - 1);
    const x =
      side === "bid"
        ? pad + ratio * half
        : center + ratio * half;
    const qty = level.cumulativeQty ?? level.quantity ?? 0;
    const y = h - pad - (qty / maxQty) * (h - pad * 2);
    return { x, y, level };
  });
}

function path(points) {
  if (!points.length) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

function area(points, side, w, h, pad) {
  if (!points.length) return "";
  const baseY = h - pad;
  const first = points[0];
  const last = points[points.length - 1];
  const edgeX = side === "bid" ? pad : w - pad;
  return `M ${edgeX} ${baseY} L ${first.x} ${baseY} ${path(points).replace("M", "L")} L ${last.x} ${baseY} Z`;
}

export default function DepthChart({ bids = [], asks = [], outcome = "YES" }) {
  const w = 560;
  const h = 180;
  const pad = 18;
  const visibleBids = bids.slice(0, 18);
  const visibleAsks = asks.slice(0, 18);
  const maxQty = Math.max(
    1,
    ...visibleBids.map((l) => l.cumulativeQty ?? l.quantity ?? 0),
    ...visibleAsks.map((l) => l.cumulativeQty ?? l.quantity ?? 0)
  );

  const bidPoints = pointsForDepth(visibleBids, "bid", w, h, pad, maxQty);
  const askPoints = pointsForDepth(visibleAsks, "ask", w, h, pad, maxQty);
  const bestBid = visibleBids[0]?.priceCents;
  const bestAsk = visibleAsks[0]?.priceCents;
  const mid = bestBid != null && bestAsk != null ? Math.round((bestBid + bestAsk) / 2) : null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="text-[var(--yes)]">Cumulative bids</span>
        <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[var(--muted)]">
          {outcome} depth {mid != null ? `· mid ${mid}¢` : ""}
        </span>
        <span className="text-[var(--no)]">Cumulative asks</span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-48 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`depthBid-${outcome}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--yes)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--yes)" stopOpacity="0.04" />
          </linearGradient>
          <linearGradient id={`depthAsk-${outcome}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--no)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--no)" stopOpacity="0.04" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((r) => (
          <line
            key={r}
            x1={pad}
            x2={w - pad}
            y1={pad + r * (h - pad * 2)}
            y2={pad + r * (h - pad * 2)}
            stroke="var(--border)"
            strokeOpacity="0.55"
            strokeWidth="1"
          />
        ))}
        <line x1={w / 2} x2={w / 2} y1={pad} y2={h - pad} stroke="var(--border)" strokeDasharray="4 4" />
        {bidPoints.length > 0 && <path d={area(bidPoints, "bid", w, h, pad)} fill={`url(#depthBid-${outcome})`} />}
        {askPoints.length > 0 && <path d={area(askPoints, "ask", w, h, pad)} fill={`url(#depthAsk-${outcome})`} />}
        {bidPoints.length > 0 && <path d={path(bidPoints)} fill="none" stroke="var(--yes)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
        {askPoints.length > 0 && <path d={path(askPoints)} fill="none" stroke="var(--no)" strokeWidth="2" vectorEffect="non-scaling-stroke" />}
      </svg>
      <div className="mt-2 grid grid-cols-3 text-xs text-[var(--muted)]">
        <span>{visibleBids.at(-1)?.priceCents ?? "—"}¢</span>
        <span className="text-center">spread {bestBid != null && bestAsk != null ? `${bestAsk - bestBid}¢` : "—"}</span>
        <span className="text-right">{visibleAsks.at(-1)?.priceCents ?? "—"}¢</span>
      </div>
    </div>
  );
}
