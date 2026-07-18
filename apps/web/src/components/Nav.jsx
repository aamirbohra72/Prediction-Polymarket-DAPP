"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, setToken } from "@/lib/api";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";
import WalletConnectButton from "./WalletConnectButton";

export default function Nav() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [q, setQ] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

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

  function onSearch(e) {
    e.preventDefault();
    const symbol = q.trim().toUpperCase();
    router.push(symbol ? `/?symbol=${encodeURIComponent(symbol)}` : "/");
    setMenuOpen(false);
  }

  const links = [
    { href: "/", label: "Markets" },
    { href: "/watchlist", label: "Watchlist" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/activity", label: "Activity" },
    { href: "/web3", label: "Web3" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3">
        <Link href="/" className="shrink-0 text-lg font-bold tracking-tight">
          Stock<span className="text-[var(--accent)]">Predict</span>
        </Link>

        <form onSubmit={onSearch} className="relative mx-2 hidden min-w-0 flex-1 md:block lg:max-w-md">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]">
            ⌕
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search markets (AAPL, TSLA…)"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--accent)]"
          />
        </form>

        <nav className="ml-auto hidden items-center gap-3 text-sm text-[var(--muted)] lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-[var(--text)]">
              {l.label}
            </Link>
          ))}
          {user?.isAdmin && (
            <Link href="/admin" className="hover:text-[var(--text)]">
              Admin
            </Link>
          )}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-2">
          <ThemeToggle />
          <WalletConnectButton />
          {user ? (
            <div className="flex items-center gap-2">
              <NotificationBell />
              <Link
                href="/profile"
                className="hidden max-w-[10rem] truncate rounded-full bg-[var(--bg)] px-3 py-1.5 text-sm font-medium hover:text-[var(--accent)] sm:inline"
                title={user.email}
              >
                {user.displayName || user.email?.split("@")[0] || "Account"}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="hidden text-sm text-[var(--muted)] hover:text-[var(--text)] sm:inline"
              >
                Log out
              </button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Link href="/login" className="text-sm text-[var(--muted)] hover:text-[var(--text)]">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-lg bg-[var(--accent)] px-3 py-1.5 text-sm font-medium text-white hover:opacity-90"
              >
                Sign up
              </Link>
            </div>
          )}
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-2 py-1 text-sm lg:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            ☰
          </button>
        </div>
      </div>

      {menuOpen && (
        <div className="border-t border-[var(--border)] bg-[var(--surface)] px-4 py-3 lg:hidden">
          <form onSubmit={onSearch} className="mb-3 md:hidden">
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search symbol…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg)] px-3 py-2 text-sm"
            />
          </form>
          <div className="flex flex-col gap-2 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>
                {l.label}
              </Link>
            ))}
            {user?.isAdmin && (
              <Link href="/admin" onClick={() => setMenuOpen(false)}>
                Admin
              </Link>
            )}
            {!user && (
              <>
                <Link href="/login" onClick={() => setMenuOpen(false)}>
                  Log in
                </Link>
                <Link href="/register" onClick={() => setMenuOpen(false)}>
                  Sign up
                </Link>
              </>
            )}
            {user && (
              <>
                <Link href="/profile" onClick={() => setMenuOpen(false)} className="font-medium">
                  {user.displayName || user.email?.split("@")[0] || "Account"}
                </Link>
                <button type="button" onClick={logout} className="text-left">
                  Log out
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
