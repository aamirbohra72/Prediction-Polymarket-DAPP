"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

export default function WalletConnectButton() {
  const { publicKey } = useWallet();

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
