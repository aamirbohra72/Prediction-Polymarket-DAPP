"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function ActivityPage() {
  const [activity, setActivity] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .activity(50)
      .then((d) => setActivity(d.activity))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));

    const t = setInterval(() => {
      api.activity(50).then((d) => setActivity(d.activity)).catch(() => {});
    }, 20000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p className="text-[var(--muted)]">Loading activity…</p>;

  return (
    <div className="max-w-3xl">
      <h1 className="mb-2 text-2xl font-bold">Live activity</h1>
      <p className="mb-6 text-sm text-[var(--muted)]">
        Recent trades across all markets · refreshes every 20s
      </p>

      {error && <p className="mb-4 text-red-400">{error}</p>}

      {activity.length === 0 ? (
        <p className="text-[var(--muted)]">No trades yet.</p>
      ) : (
        <ul className="space-y-3">
          {activity.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <Link
                    href={`/markets/${item.market.id}`}
                    className="font-medium hover:text-[var(--accent)]"
                  >
                    {item.market.symbol}
                  </Link>
                  <p className="mt-1 text-sm">{item.text}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {item.buyer} → {item.seller}
                  </p>
                </div>
                <span className="text-xs text-[var(--muted)]">
                  {new Date(item.at).toLocaleString()}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
