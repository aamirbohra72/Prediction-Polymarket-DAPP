"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function PlatformStats() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.platformStats().then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  if (!stats) return null;

  const items = [
    { label: "Traders", value: stats.users },
    { label: "Markets", value: stats.markets },
    { label: "Open", value: stats.openMarkets },
    { label: "Volume", value: stats.totalVolume },
  ];

  return (
    <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-center"
        >
          <p className="text-2xl font-bold">{item.value.toLocaleString()}</p>
          <p className="text-xs text-[var(--muted)]">{item.label}</p>
        </div>
      ))}
    </div>
  );
}
