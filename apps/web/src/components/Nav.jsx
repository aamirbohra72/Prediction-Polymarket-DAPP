"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, setToken } from "@/lib/api";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import WalletConnectButton from "./WalletConnectButton";

export default function Nav() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;
    api
      .me()
      .then((d) => setUser(d.user))
      .catch(() => setToken(null));
  }, []);

  function logout() {
    setToken(null);
    setUser(null);
    window.location.href = "/";
  }

  return (
    <header className="border-b border-[var(--border)] bg-[var(--surface)]">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          StockPredict
        </Link>
        <nav className="flex flex-wrap items-center gap-4 text-sm text-[var(--muted)]">
          <Link href="/" className="hover:text-[var(--text)]">
            Markets
          </Link>
          <Link href="/watchlist" className="hover:text-[var(--text)]">
            Watchlist
          </Link>
          <Link href="/portfolio" className="hover:text-[var(--text)]">
            Portfolio
          </Link>
          <Link href="/leaderboard" className="hover:text-[var(--text)]">
            Leaderboard
          </Link>
          <Link href="/activity" className="hover:text-[var(--text)]">
            Activity
          </Link>
          <Link href="/web3" className="hover:text-[var(--text)]">
            Web3
          </Link>
          {user?.isAdmin && (
            <Link href="/admin" className="hover:text-[var(--text)]">
              Admin
            </Link>
          )}
          <ThemeToggle />
          <WalletConnectButton />
          {user ? (
            <div className="flex items-center gap-3">
              <NotificationBell />
              <Link href="/profile" className="hover:text-[var(--text)]">
                {user.displayName || "Profile"}
              </Link>
              <span className="rounded-full bg-[var(--bg)] px-3 py-1 text-[var(--text)]">
                ${user.balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <button
                type="button"
                onClick={logout}
                className="hover:text-[var(--text)]"
              >
                Log out
              </button>
            </div>
          ) : (
            <>
              <Link href="/login" className="hover:text-[var(--text)]">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-white hover:opacity-90"
              >
                Sign up
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
