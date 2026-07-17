"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { api, streamActivityUrl, getToken } from "@/lib/api";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "trade", label: "Trades" },
  { id: "comment", label: "Comments" },
  { id: "resolution", label: "Resolutions" },
  { id: "market", label: "New markets" },
  { id: "order", label: "Large orders" },
  { id: "deposit", label: "Deposits" },
  { id: "highlight", label: "Highlights" },
  { id: "following", label: "Following", auth: true },
  { id: "mine", label: "My activity", auth: true },
];

const TYPE_STYLES = {
  trade: "bg-emerald-500/15 text-emerald-400",
  comment: "bg-sky-500/15 text-sky-400",
  resolution: "bg-amber-500/15 text-amber-400",
  market: "bg-violet-500/15 text-violet-400",
  order: "bg-orange-500/15 text-orange-400",
  deposit: "bg-teal-500/15 text-teal-400",
  alert: "bg-rose-500/15 text-rose-400",
  highlight: "bg-yellow-500/15 text-yellow-400",
  cancel: "bg-[var(--bg)] text-[var(--muted)]",
};

const TYPE_LABELS = {
  trade: "Trade",
  comment: "Comment",
  resolution: "Resolved",
  market: "Market",
  order: "Order",
  deposit: "Deposit",
  alert: "Alert",
  highlight: "Move",
  cancel: "Cancel",
};

function TypeBadge({ type, highlight }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        TYPE_STYLES[type] || "bg-[var(--bg)] text-[var(--muted)]"
      }`}
    >
      {highlight === "whale"
        ? "Whale"
        : highlight === "chance_move"
          ? "Chance"
          : highlight === "volume_spike"
            ? "Volume"
            : highlight === "large_order"
              ? "Large"
              : TYPE_LABELS[type] || type}
    </span>
  );
}

function ActivityRow({ item, onFollow, followingIds, me }) {
  const href = item.href || (item.market ? `/markets/${item.market.id}` : null);
  const authorId = item.authorId || item.buyerId;

  return (
    <li className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4 transition hover:border-[var(--accent)]/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <TypeBadge type={item.type} highlight={item.highlight} />
            {item.market && (
              <Link
                href={href || `/markets/${item.market.id}`}
                className="font-medium hover:text-[var(--accent)]"
              >
                {item.market.symbol}
              </Link>
            )}
            {item.highlight === "whale" && (
              <span className="text-[10px] font-semibold text-amber-400">WHALE</span>
            )}
          </div>
          {href ? (
            <Link href={href} className="block text-sm hover:text-[var(--accent)]">
              {item.text}
            </Link>
          ) : (
            <p className="text-sm">{item.text}</p>
          )}
          {item.type === "trade" && (
            <p className="mt-1 text-xs text-[var(--muted)]">
              {item.buyer} → {item.seller}
            </p>
          )}
          {(item.type === "comment" || item.type === "order") && item.author && (
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span>{item.author}</span>
              {item.likeCount != null && <span>· {item.likeCount} likes</span>}
              {me && authorId && authorId !== me.id && onFollow && (
                <button
                  type="button"
                  onClick={() => onFollow(authorId, followingIds?.has(authorId))}
                  className="text-[var(--accent)] hover:underline"
                >
                  {followingIds?.has(authorId) ? "Unfollow" : "Follow"}
                </button>
              )}
            </div>
          )}
          {item.type === "resolution" && item.winningOutcome && (
            <p className="mt-1 text-xs text-[var(--muted)]">Winner: {item.winningOutcome}</p>
          )}
          {href && (item.type === "trade" || item.type === "order") && (
            <Link
              href={href}
              className="mt-2 inline-block text-xs font-medium text-[var(--accent)] hover:underline"
            >
              Trade this →
            </Link>
          )}
        </div>
        <span className="shrink-0 text-xs text-[var(--muted)]">
          {new Date(item.at).toLocaleString()}
        </span>
      </div>
    </li>
  );
}

export default function ActivityPage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">Loading activity…</p>}>
      <ActivityPageInner />
    </Suspense>
  );
}

function ActivityPageInner() {
  const searchParams = useSearchParams();
  const initial = searchParams.get("type") || "all";
  const [activity, setActivity] = useState([]);
  const [filter, setFilter] = useState(initial);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(false);
  const [me, setMe] = useState(null);
  const [followingIds, setFollowingIds] = useState(new Set());

  useEffect(() => {
    api.me().then((d) => setMe(d.user)).catch(() => setMe(null));
  }, []);

  useEffect(() => {
    if (!me) return;
    api
      .following()
      .then((d) => setFollowingIds(new Set((d.following || []).map((u) => u.id))))
      .catch(() => {});
  }, [me]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const needsAuth = filter === "mine" || filter === "following";
    if (needsAuth && !getToken()) {
      setActivity([]);
      setError("Log in to view this feed");
      setLoading(false);
      setLive(false);
      return;
    }

    // Personalized feeds use REST poll; public feeds use SSE
    if (needsAuth) {
      api
        .activity(50, filter)
        .then((d) => {
          if (!cancelled) setActivity(d.activity || []);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });

      const t = setInterval(() => {
        api
          .activity(50, filter)
          .then((d) => setActivity(d.activity || []))
          .catch(() => {});
      }, 15000);
      return () => {
        cancelled = true;
        clearInterval(t);
      };
    }

    const es = new EventSource(streamActivityUrl(filter, 50));
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.error) return;
        if (data.activity) {
          setActivity(data.activity);
          setLive(true);
          setLoading(false);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      setLive(false);
      // Fallback REST once if SSE fails
      api
        .activity(50, filter)
        .then((d) => {
          if (!cancelled) {
            setActivity(d.activity || []);
            setLoading(false);
          }
        })
        .catch((e) => {
          if (!cancelled) {
            setError(e.message);
            setLoading(false);
          }
        });
    };

    return () => {
      cancelled = true;
      es.close();
    };
  }, [filter]);

  async function onFollow(userId, isFollowing) {
    try {
      if (isFollowing) {
        await api.unfollowUser(userId);
        setFollowingIds((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      } else {
        await api.followUser(userId);
        setFollowingIds((prev) => new Set(prev).add(userId));
      }
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <div className="max-w-3xl">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
        <h1 className="text-2xl font-bold">Live activity</h1>
        <span className="text-xs text-[var(--muted)]">
          {live ? (
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              Live · SSE
            </span>
          ) : (
            "Refreshing…"
          )}
        </span>
      </div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Trades, comments, resolutions, large orders, deposits, and chance moves. Tap a trade to
        open the ticket prefilled.
      </p>

      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          if (f.auth && !me) return null;
          return (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={`rounded-lg px-3 py-1.5 text-sm transition ${
                filter === f.id
                  ? "bg-[var(--accent)] text-white"
                  : "border border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--fg)]"
              }`}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {error && (
        <p className="mb-4 text-red-400">
          {error}{" "}
          {error.toLowerCase().includes("log in") && (
            <Link href="/login" className="underline">
              Log in
            </Link>
          )}
        </p>
      )}

      {loading ? (
        <p className="text-[var(--muted)]">Loading activity…</p>
      ) : activity.length === 0 ? (
        <p className="text-[var(--muted)]">
          No items in this feed yet. Place a trade, comment, or follow a trader.
        </p>
      ) : (
        <ul className="space-y-3">
          {activity.map((item) => (
            <ActivityRow
              key={item.id}
              item={item}
              me={me}
              followingIds={followingIds}
              onFollow={onFollow}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
