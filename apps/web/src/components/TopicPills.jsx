"use client";

import { DEFAULT_TOPIC_CHIPS } from "@/lib/categories";

export default function TopicPills({ category, symbol, symbols = [], onSymbol }) {
  const fallback = category ? DEFAULT_TOPIC_CHIPS[category] || [] : [];
  const fromFacets = symbols.map((s) => (typeof s === "string" ? s : s.symbol));
  const tickers = fromFacets.length > 0 ? fromFacets : fallback;

  const chips = [{ label: "All", symbol: "" }, ...tickers.map((t) => ({ label: t, symbol: t }))];

  return (
    <div className="category-rail mb-5 flex gap-2 overflow-x-auto pb-1">
      {chips.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onSymbol(t.symbol)}
          className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium transition ${
            symbol === t.symbol
              ? "bg-[var(--accent)] text-white"
              : "border border-[var(--border)] text-[var(--muted)] hover:text-[var(--text)]"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
