"use client";

import { MARKET_CATEGORIES } from "@/lib/categories";

const TIMEFRAMES = [
  { id: "daily", label: "Daily", icon: "☀" },
  { id: "weekly", label: "Weekly", icon: "◐" },
  { id: "monthly", label: "Monthly", icon: "◉" },
];

const STATUS_ITEMS = [
  { id: "OPEN", label: "Open", icon: "●" },
  { id: "CLOSED", label: "Closing", icon: "◷" },
  { id: "RESOLVED", label: "Resolved", icon: "✓" },
];

export default function CategorySidebar({
  category,
  status,
  timeframe,
  counts = {},
  timeframeCounts = {},
  total = 0,
  onCategory,
  onStatus,
  onTimeframe,
}) {
  return (
    <aside className="w-full shrink-0 lg:w-52">
      <nav className="flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:pb-0">
        <SidebarItem
          active={!category && !status && !timeframe}
          icon="✦"
          label="All"
          count={total}
          onClick={() => onCategory("")}
        />

        <p className="mb-1 mt-3 hidden px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] lg:block">
          Timeframe
        </p>

        {TIMEFRAMES.map((t) => (
          <SidebarItem
            key={t.id}
            active={timeframe === t.id && !status}
            icon={t.icon}
            label={t.label}
            count={timeframeCounts[t.id] ?? 0}
            onClick={() => onTimeframe(t.id)}
          />
        ))}

        <p className="mb-1 mt-3 hidden px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] lg:block">
          Categories
        </p>

        {MARKET_CATEGORIES.map((c) => (
          <SidebarItem
            key={c.id}
            active={category === c.id && !status}
            icon={c.icon}
            label={c.label}
            count={counts[c.id] ?? 0}
            onClick={() => onCategory(c.id)}
          />
        ))}

        <p className="mb-1 mt-3 hidden px-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)] lg:block">
          Status
        </p>

        {STATUS_ITEMS.map((s) => (
          <SidebarItem
            key={s.id}
            active={status === s.id}
            icon={s.icon}
            label={s.label}
            onClick={() => onStatus(s.id)}
          />
        ))}
      </nav>
    </aside>
  );
}

function SidebarItem({ active, icon, label, count, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition lg:w-full ${
        active
          ? "bg-[var(--surface-2)] font-medium text-[var(--text)]"
          : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--text)]"
      }`}
    >
      <span className="w-4 text-center text-xs">{icon}</span>
      <span className="flex-1 whitespace-nowrap">{label}</span>
      {count != null && (
        <span className="hidden text-[11px] tabular-nums text-[var(--muted)] lg:inline">
          {count}
        </span>
      )}
    </button>
  );
}
