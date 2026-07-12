"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [light, setLight] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("theme");
    const isLight = saved === "light";
    setLight(isLight);
    document.documentElement.classList.toggle("light", isLight);
  }, []);

  function toggle() {
    const next = !light;
    setLight(next);
    localStorage.setItem("theme", next ? "light" : "dark");
    document.documentElement.classList.toggle("light", next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="rounded-lg border border-[var(--border)] px-2 py-1 text-xs text-[var(--muted)] hover:text-[var(--text)]"
      aria-label="Toggle theme"
    >
      {light ? "Dark" : "Light"}
    </button>
  );
}
