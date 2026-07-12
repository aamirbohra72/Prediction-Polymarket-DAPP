"use client";

const CATEGORIES = [
  { id: "", label: "Trending", icon: "🔥" },
  { id: "STOCK", label: "Stocks", icon: "📈" },
  { id: "SPORTS", label: "Sports", icon: "🏆" },
  { id: "OPEN", label: "Open", icon: "●", status: true },
  { id: "CLOSED", label: "Closing", icon: "◷", status: true },
  { id: "RESOLVED", label: "Resolved", icon: "✓", status: true },
];

export default function CategoryRail({ category, status, onCategory, onStatus }) {
  return (
    <div className="category-rail -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 pb-1">
      {CATEGORIES.map((c) => {
        const active = c.status ? status === c.id : category === c.id && !status;
        return (
          <button
            key={`${c.id}-${c.label}`}
            type="button"
            onClick={() => {
              if (c.status) {
                onStatus(c.id);
                onCategory("");
              } else {
                onCategory(c.id);
                onStatus("");
              }
            }}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition ${
              active
                ? "border-[var(--accent)] bg-[var(--accent)]/15 text-[var(--text)]"
                : "border-[var(--border)] bg-[var(--surface)] text-[var(--muted)] hover:text-[var(--text)]"
            }`}
          >
            <span className="text-xs">{c.icon}</span>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}
