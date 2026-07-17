"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, streamMarketUrl } from "@/lib/api";
import Countdown from "@/components/Countdown";
import OrderBook from "@/components/OrderBook";
import PriceChart from "@/components/PriceChart";
import TradePanel from "@/components/TradePanel";
import TradesTape from "@/components/TradesTape";
import WatchlistStar from "@/components/WatchlistStar";

export default function MarketPage() {
  const { id } = useParams();
  const [market, setMarket] = useState(null);
  const [user, setUser] = useState(null);
  const [position, setPosition] = useState(null);
  const [activity, setActivity] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [alertTarget, setAlertTarget] = useState(60);
  const [alertDir, setAlertDir] = useState("ABOVE");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [outcome, setOutcome] = useState("YES");
  const [side, setSide] = useState("BUY");
  const [priceCents, setPriceCents] = useState(50);
  const [quantity, setQuantity] = useState(10);
  const [submitting, setSubmitting] = useState(false);
  const [bookOutcome, setBookOutcome] = useState("YES");
  const [orderType, setOrderType] = useState("LIMIT");

  const loadMeta = useCallback(() => {
    return Promise.all([
      api.me().catch(() => null),
      api.positions().catch(() => ({ positions: [] })),
      api.marketActivity(id).catch(() => ({ activity: [] })),
      api.marketComments(id).catch(() => ({ comments: [] })),
    ]).then(([me, pos, act, comm]) => {
      if (me) setUser(me.user);
      const p = pos.positions.find((x) => x.market.id === id);
      setPosition(p || null);
      setActivity(act.activity);
      setComments(comm.comments);
    });
  }, [id]);

  useEffect(() => {
    Promise.all([api.market(id).catch(() => null), loadMeta()])
      .then(([m]) => {
        if (m?.market) setMarket(m.market);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id, loadMeta]);

  useEffect(() => {
    if (!user) return;
    const t = setInterval(() => loadMeta(), 8000);
    return () => clearInterval(t);
  }, [user, loadMeta]);

  useEffect(() => {
    if (!id) return;

    const es = new EventSource(streamMarketUrl(id));
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        if (data.market) {
          setMarket(data.market);
        }
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => es.close();

    return () => es.close();
  }, [id]);

  async function handleTrade(e) {
    e.preventDefault();
    if (!user) {
      setError("Please log in to trade");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await api.placeOrder(id, {
        outcome,
        side,
        orderType,
        priceCents: orderType === "LIMIT" ? Number(priceCents) : undefined,
        quantity: Number(quantity),
      });
      if (res.resting) setError(res.message);
      await loadMeta();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function cancelOrder(orderId) {
    try {
      await api.cancelOrder(orderId);
      await loadMeta();
    } catch (err) {
      setError(err.message);
    }
  }

  function pickBookLevel({ priceCents: pickedPrice, side: pickedSide }) {
    setOutcome(bookOutcome);
    setSide(pickedSide);
    setPriceCents(pickedPrice);
    setOrderType("LIMIT");
    setError(`Loaded ${pickedSide} ${bookOutcome} at ${pickedPrice}¢ into the trade ticket`);
  }

  async function postComment(e) {
    e.preventDefault();
    if (!user) return;
    try {
      await api.postComment(id, commentText);
      setCommentText("");
      const comm = await api.marketComments(id);
      setComments(comm.comments);
    } catch (err) {
      setError(err.message);
    }
  }

  async function createAlert(e) {
    e.preventDefault();
    if (!user) return;
    try {
      await api.createAlert({
        marketId: id,
        targetCents: Number(alertTarget),
        direction: alertDir,
      });
      setError("");
      alert("Price alert created");
    } catch (err) {
      setError(err.message);
    }
  }

  if (loading && !market) return <p className="text-[var(--muted)]">Loading market…</p>;
  if (!market) return <p className="text-red-400">Market not found</p>;

  const yesPrice = market.impliedYesPrice ?? 50;
  const quote = market.liveQuote;

  return (
    <div>
      <Link href="/" className="mb-4 inline-block text-sm text-[var(--muted)] hover:text-[var(--text)]">
        ← Back to markets
      </Link>

      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded bg-[var(--surface)] px-2 py-0.5 text-sm text-[var(--muted)]">
              {market.symbol}
            </span>
            <WatchlistStar marketId={market.id} initial={market.watchlisted} />
            <span className="text-xs text-[var(--muted)]">{market.category}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold">{market.title}</h1>
          {market.description && (
            <p className="mt-2 text-sm text-[var(--muted)]">{market.description}</p>
          )}
          <p className="mt-2 text-[var(--muted)]">
            Strike ${market.strike} · Resolves {String(market.resolveDate).slice(0, 10)} ·{" "}
            {market.status}
            {market.openInterest != null && ` · Open interest ${market.openInterest}`}
          </p>
          {quote && (
            <p className="mt-2 text-sm">
              Live {market.symbol}:{" "}
              <span className="font-medium text-[var(--text)]">${quote.current?.toFixed(2)}</span>
              {quote.changePercent != null && (
                <span className={quote.changePercent >= 0 ? "text-[var(--yes)]" : "text-[var(--no)]"}>
                  {" "}
                  ({quote.changePercent >= 0 ? "+" : ""}
                  {quote.changePercent.toFixed(2)}%)
                </span>
              )}
            </p>
          )}
        </div>
        {market.status === "OPEN" && <Countdown resolveDate={market.resolveDate} />}
      </div>

      <div className="mb-8 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-semibold">YES probability</h2>
              <span className="text-xs text-[var(--yes)]">Live</span>
            </div>
            <PriceChart history={market.priceHistory} />
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold">Order book</h2>
              <div className="flex gap-1 rounded-lg border border-[var(--border)] p-0.5">
                {["YES", "NO"].map((o) => (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setBookOutcome(o)}
                    className={`rounded px-3 py-1 text-xs ${
                      bookOutcome === o ? "bg-[var(--bg)]" : "text-[var(--muted)]"
                    }`}
                  >
                    {o}
                  </button>
                ))}
              </div>
            </div>
            <OrderBook depth={market.depth} outcome={bookOutcome} onLevelClick={pickBookLevel} />
          </div>

          <TradesTape trades={market.recentTrades} />

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 font-semibold">Activity</h2>
            <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
              {activity.length === 0 ? (
                <li className="text-[var(--muted)]">No activity yet</li>
              ) : (
                activity.map((a, i) => (
                  <li key={i} className="flex justify-between gap-2 border-b border-[var(--border)] py-2">
                    <span>{a.type === "comment" ? `${a.author}: ${a.text}` : a.text}</span>
                    <span className="shrink-0 text-[var(--muted)]">
                      {new Date(a.at).toLocaleString()}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 font-semibold">Discussion</h2>
            <ul className="mb-4 max-h-40 space-y-2 overflow-y-auto text-sm">
              {comments.map((c) => (
                <li key={c.id} className="rounded-lg bg-[var(--bg)] p-2">
                  <span className="font-medium">{c.author}</span>
                  <p className="text-[var(--muted)]">{c.body}</p>
                </li>
              ))}
            </ul>
            {user && (
              <form onSubmit={postComment} className="flex gap-2">
                <input
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
                />
                <button type="submit" className="rounded-lg bg-[var(--accent)] px-3 py-2 text-sm text-white">
                  Post
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex justify-between text-lg">
              <span className="text-[var(--yes)]">YES {yesPrice}¢</span>
              <span className="text-[var(--no)]">NO {100 - yesPrice}¢</span>
            </div>
            <div className="h-3 overflow-hidden rounded-full bg-[var(--bg)]">
              <div className="h-full bg-[var(--yes)]" style={{ width: `${yesPrice}%` }} />
            </div>
            {position && (
              <div className="mt-4 rounded-lg bg-[var(--bg)] p-3 text-sm">
                <p className="font-medium">Your position</p>
                <p className="text-[var(--yes)]">YES: {position.yesShares}</p>
                <p className="text-[var(--no)]">NO: {position.noShares}</p>
              </div>
            )}
          </div>

          {market.status === "OPEN" ? (
            <TradePanel
              user={user}
              position={position}
              outcome={outcome}
              setOutcome={setOutcome}
              side={side}
              setSide={setSide}
              priceCents={priceCents}
              setPriceCents={setPriceCents}
              quantity={quantity}
              setQuantity={setQuantity}
              orderType={orderType}
              setOrderType={setOrderType}
              onSubmit={handleTrade}
              submitting={submitting}
              error={error}
              mintEnabled={true}
              spread={market.spread}
            />
          ) : (
            <div className="rounded-xl border border-[var(--border)] p-6 text-[var(--muted)]">
              Trading closed.
            </div>
          )}

          {user && market.status === "OPEN" && (
            <form onSubmit={createAlert} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-3 text-sm font-semibold">Price alert</h3>
              <div className="mb-2 flex gap-2">
                <select
                  value={alertDir}
                  onChange={(e) => setAlertDir(e.target.value)}
                  className="rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                >
                  <option value="ABOVE">YES above</option>
                  <option value="BELOW">YES below</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={alertTarget}
                  onChange={(e) => setAlertTarget(e.target.value)}
                  className="w-16 rounded border border-[var(--border)] bg-[var(--bg)] px-2 py-1 text-sm"
                />
                <span className="self-center text-sm">¢</span>
              </div>
              <button type="submit" className="text-sm text-[var(--accent)] hover:underline">
                Create alert
              </button>
            </form>
          )}

          {market.myOpenOrders?.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-2 text-sm font-semibold">Your open orders</h3>
              <ul className="space-y-2 text-sm">
                {market.myOpenOrders.map((o) => (
                  <li key={o.id} className="flex items-center justify-between gap-2">
                    <span>
                      {o.side} {o.outcome} {o.priceCents}¢ × {o.quantity - o.filledQty}
                    </span>
                    <button
                      type="button"
                      onClick={() => cancelOrder(o.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {market.relatedMarkets?.length > 0 && (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h3 className="mb-2 text-sm font-semibold">Related {market.symbol} markets</h3>
              <ul className="space-y-2 text-sm">
                {market.relatedMarkets.map((m) => (
                  <li key={m.id}>
                    <Link href={`/markets/${m.id}`} className="text-[var(--accent)] hover:underline">
                      {m.title}
                    </Link>
                    <span className="ml-2 text-xs text-[var(--muted)]">{m.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
