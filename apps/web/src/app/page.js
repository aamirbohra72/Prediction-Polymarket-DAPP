"use client";

import { Suspense } from "react";
import HomeContent from "@/components/HomeContent";

export default function HomePage() {
  return (
    <Suspense fallback={<p className="text-[var(--muted)]">Loading markets…</p>}>
      <HomeContent />
    </Suspense>
  );
}
