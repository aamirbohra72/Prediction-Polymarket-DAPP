"use client";

import Link from "next/link";

export default function HotTopics({ markets = [] }) {
  const ranked = [...markets]
    .filter((m) => m.status === "OPEN" || m.status === "CLOSED")
    .sort((a, b) => (b.volume ?? 0) - (a.volume ?? 0))
    .slice(0, 8);

  return (
    <aside className="space-y-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-1 text-sm font-semibold">Play money trading</p>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Start with $10,000 virtual cash. No real funds at risk.
        </p>
        <Link
          href="/register"
          className="inline-block rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Get started
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="mb-1 text-sm font-semibold">Web3 ready</p>
        <p className="mb-3 text-xs text-[var(--muted)]">
          Connect a Solana wallet when you want on-chain settlement.
        </p>
        <Link
          href="/web3"
          className="inline-block rounded-lg border border-[var(--border)] px-3 py-2 text-sm hover:bg-[var(--bg)]"
        >
          Open Web3
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Hot topics</h3>
          <span className="text-xs text-[var(--muted)]">by volume</span>
        </div>
        {ranked.length === 0 ? (
          <p className="text-xs text-[var(--muted)]">No open markets yet.</p>
        ) : (
          <ol className="space-y-3">
            {ranked.map((m, i) => (
              <li key={m.id}>
                <Link href={`/markets/${m.id}`} className="flex items-start gap-2 group">
                  <span className="w-4 shrink-0 text-xs text-[var(--muted)]">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium group-hover:text-[var(--accent)]">
                      {m.symbol}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">{m.title}</p>
                  </div>
                  <div className="shrink-0 text-right text-xs">
                    <p className="text-[var(--accent)]">{m.impliedYesPrice ?? 50}%</p>
                    <p className="text-[var(--muted)]">Vol {m.volume ?? 0}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ol>
        )}
      </div>
    </aside>
  );
}
