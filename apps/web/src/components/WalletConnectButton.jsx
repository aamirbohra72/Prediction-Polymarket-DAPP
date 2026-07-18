"use client";

import { useEffect, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wallet adapters inspect browser extensions and localStorage. Rendering the
  // real button only after mount keeps the server and first client tree equal.
  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Loading wallet"
        className="h-8 rounded-lg bg-[var(--bg)] px-4 text-xs text-[var(--text)] opacity-70"
      >
        Connect wallet
      </button>
    );
  }

  return (
    <WalletMultiButton className="!h-8 !rounded-lg !bg-[var(--bg)] !text-xs !text-[var(--text)] hover:!opacity-90" />
  );
}
