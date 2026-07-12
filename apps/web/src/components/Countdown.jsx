"use client";

import { useEffect, useState } from "react";

export default function Countdown({ resolveDate }) {
  const [label, setLabel] = useState("");

  useEffect(() => {
    function tick() {
      const end = new Date(resolveDate);
      end.setHours(23, 59, 59, 999);
      const diff = end - Date.now();
      if (diff <= 0) {
        setLabel("Resolving soon");
        return;
      }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      if (days > 0) setLabel(`${days}d ${hours}h left`);
      else setLabel(`${hours}h left`);
    }
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, [resolveDate]);

  if (!label) return null;
  return <span className="text-xs text-amber-400">{label}</span>;
}
