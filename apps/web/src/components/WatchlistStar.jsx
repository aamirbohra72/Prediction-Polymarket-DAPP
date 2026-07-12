"use client";

import { useState } from "react";
import { api } from "@/lib/api";

export default function WatchlistStar({ marketId, initial = false, onChange }) {
  const [active, setActive] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function toggle(e) {
    e.preventDefault();
    e.stopPropagation();
    setLoading(true);
    try {
      if (active) {
        await api.removeWatchlist(marketId);
        setActive(false);
        onChange?.(false);
      } else {
        await api.addWatchlist(marketId);
        setActive(true);
        onChange?.(true);
      }
    } catch {
      /* login required */
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={loading}
      className={`text-lg leading-none ${active ? "text-amber-400" : "text-[var(--muted)] hover:text-amber-300"}`}
      aria-label={active ? "Remove from watchlist" : "Add to watchlist"}
    >
      {active ? "★" : "☆"}
    </button>
  );
}
