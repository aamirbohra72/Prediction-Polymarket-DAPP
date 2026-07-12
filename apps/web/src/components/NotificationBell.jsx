"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);

  function load() {
    api
      .notifications()
      .then((d) => {
        setItems(d.notifications);
        setUnread(d.unread);
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 30000);
    return () => clearInterval(id);
  }, []);

  async function markAllRead() {
    await api.readAllNotifications();
    load();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border border-[var(--border)] px-2 py-1 text-sm hover:bg-[var(--bg)]"
      >
        Alerts
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--no)] text-[10px] text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium">Notifications</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
            {items.length === 0 ? (
              <li className="text-[var(--muted)]">No notifications</li>
            ) : (
              items.map((n) => (
                <li
                  key={n.id}
                  className={`rounded-lg p-2 ${n.read ? "opacity-60" : "bg-[var(--bg)]"}`}
                >
                  <p className="font-medium">{n.title}</p>
                  <p className="text-xs text-[var(--muted)]">{n.body}</p>
                  {n.marketId && (
                    <Link
                      href={`/markets/${n.marketId}`}
                      className="text-xs text-[var(--accent)]"
                      onClick={() => setOpen(false)}
                    >
                      View market
                    </Link>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
