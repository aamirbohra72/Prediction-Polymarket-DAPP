"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import MarketCard from "@/components/MarketCard";

export default function WatchlistPage() {
  const [markets, setMarkets] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .markets({ watchlist: true })
      .then((d) => setMarkets(d.markets))
      .catch((e) => setError(e.message));
  }, []);

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold">Watchlist</h1>
      <p className="mb-8 text-[var(--muted)]">
        Markets you starred.{" "}
        <Link href="/" className="text-[var(--accent)] hover:underline">
          Browse all markets
        </Link>
      </p>
      {error && (
        <p className="mb-4 text-red-400">
          {error}. <Link href="/login">Log in</Link> to use watchlist.
        </p>
      )}
      {markets.length === 0 && !error ? (
        <p className="text-[var(--muted)]">No starred markets yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {markets.map((m) => (
            <MarketCard key={m.id} market={{ ...m, watchlisted: true }} />
          ))}
        </div>
      )}
    </div>
  );
}
