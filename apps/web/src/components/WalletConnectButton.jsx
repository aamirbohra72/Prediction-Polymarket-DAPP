"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletConnectButton() {
  const [mounted, setMounted] = useState(false);
  const { publicKey } = useWallet();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wallet adapters inspect browser extensions and localStorage. Rendering the
  // real button only after mount keeps the server and first client tree equal.
  if (!mounted) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-label="Loading wallet"
          className="h-8 rounded-lg bg-[var(--bg)] px-4 text-xs text-[var(--text)] opacity-70"
        >
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {publicKey && (
        <span className="hidden max-w-[120px] truncate text-xs text-[var(--muted)] sm:inline">
          {publicKey.toBase58().slice(0, 4)}…{publicKey.toBase58().slice(-4)}
        </span>
      )}
      <WalletMultiButton className="!h-8 !rounded-lg !bg-[var(--bg)] !text-xs !text-[var(--text)] hover:!opacity-90" />
    </div>
  );
}
