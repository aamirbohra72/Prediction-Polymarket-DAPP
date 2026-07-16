"use client";

import React, { useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base";
import { clusterApiUrl } from "@solana/web3.js";

const CLUSTER_MAP = {
  devnet: WalletAdapterNetwork.Devnet,
  testnet: WalletAdapterNetwork.Testnet,
  mainnet: WalletAdapterNetwork.Mainnet,
};

export default function SolanaProvider({ children }) {
  const cluster = process.env.NEXT_PUBLIC_SOLANA_CLUSTER || "devnet";
  const network = CLUSTER_MAP[cluster] || WalletAdapterNetwork.Devnet;

  const endpoint = useMemo(() => {
    return process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network);
  }, [network]);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider
        wallets={[]}
        autoConnect
        onError={(error) => {
          // User cancel / reject is expected UX — don't spam the Next.js overlay.
          const msg = String(error?.message || "");
          if (/user rejected|rejected the request|cancelled|canceled/i.test(msg)) return;
          console.warn("[wallet]", error);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
