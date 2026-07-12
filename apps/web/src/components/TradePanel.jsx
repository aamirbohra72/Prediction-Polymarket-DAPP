"use client";

import Link from "next/link";
import { useState } from "react";

export default function TradePanel({
  user,
  position,
  outcome,
  setOutcome,
  side,
  setSide,
  priceCents,
  setPriceCents,
  quantity,
  setQuantity,
  orderType,
  setOrderType,
  onSubmit,
  submitting,
  error,
  mintEnabled,
  spread,
}) {
  const held =
    outcome === "YES" ? position?.yesShares ?? 0 : position?.noShares ?? 0;
  const cost =
    side === "BUY"
      ? ((priceCents * quantity) / 100).toFixed(2)
      : ((priceCents * quantity) / 100).toFixed(2);

  return (
    <form onSubmit={onSubmit} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <h2 className="mb-4 font-semibold">Trade</h2>
      {!user && (
        <p className="mb-4 text-sm text-amber-400">
          <Link href="/login" className="underline">
            Log in
          </Link>{" "}
          to trade
        </p>
      )}

      <div className="mb-3 flex gap-2">
        {["LIMIT", "MARKET"].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setOrderType(t)}
            className={`flex-1 rounded-lg py-1.5 text-xs font-medium ${
              orderType === t
                ? "border border-[var(--accent)] text-[var(--accent)]"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {spread != null && orderType === "LIMIT" && (
        <p className="mb-3 text-xs text-[var(--muted)]">YES spread: {spread}¢</p>
      )}

      <div className="mb-3 flex gap-2">
        {["BUY", "SELL"].map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSide(s)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${
              side === s
                ? "bg-[var(--accent)] text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="mb-4 flex gap-2">
        {["YES", "NO"].map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => setOutcome(o)}
            className={`flex-1 rounded-lg py-2 font-medium ${
              outcome === o
                ? o === "YES"
                  ? "bg-[var(--yes)] text-white"
                  : "bg-[var(--no)] text-white"
                : "border border-[var(--border)] text-[var(--muted)]"
            }`}
          >
            {side} {o}
          </button>
        ))}
      </div>

      <div className={`mb-4 grid gap-4 ${orderType === "LIMIT" ? "grid-cols-2" : "grid-cols-1"}`}>
        {orderType === "LIMIT" && (
          <div>
            <label className="mb-1 block text-sm text-[var(--muted)]">Limit price (¢)</label>
            <input
              type="number"
              min={1}
              max={99}
              value={priceCents}
              onChange={(e) => setPriceCents(e.target.value)}
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
            />
          </div>
        )}
        <div>
          <label className="mb-1 block text-sm text-[var(--muted)]">Shares</label>
          <input
            type="number"
            min={1}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2"
          />
        </div>
      </div>

      {side === "SELL" && position && (
        <p className="mb-2 text-xs text-[var(--muted)]">
          You hold {held} {outcome} shares
        </p>
      )}

      <p className="mb-4 text-sm text-[var(--muted)]">
        {orderType === "MARKET"
          ? "Executes at best available price on the book"
          : side === "BUY"
            ? `Max cost: $${cost}`
            : `Proceeds if filled: $${cost}`}
        {!mintEnabled && orderType === "LIMIT" && side === "BUY" && " · rests on book if no seller"}
      </p>

      {error && <p className="mb-4 text-sm text-red-400">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !user}
        className="w-full rounded-lg bg-[var(--accent)] py-2 font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {submitting ? "Placing…" : `${side} ${outcome}`}
      </button>
    </form>
  );
}
