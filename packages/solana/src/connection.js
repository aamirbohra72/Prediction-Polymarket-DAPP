import { Connection } from "@solana/web3.js";
import { getSolanaConfig } from "./config.js";
import { isProgramConfigured } from "./marketKey.js";

let connection = null;

export function getConnection() {
  const cfg = getSolanaConfig();
  if (!connection || connection.rpcEndpoint !== cfg.rpcUrl) {
    connection = new Connection(cfg.rpcUrl, cfg.commitment);
  }
  return connection;
}

export async function getSolanaHealth() {
  const cfg = getSolanaConfig();
  if (!cfg.enabled) {
    return { enabled: false, ok: false, reason: "SOLANA_ENABLED is not true" };
  }

  try {
    const conn = getConnection();
    const [slot, version] = await Promise.all([conn.getSlot(), conn.getVersion()]);
    return {
      enabled: true,
      ok: true,
      cluster: cfg.cluster,
      rpcUrl: cfg.rpcUrl,
      slot,
      version: version["solana-core"],
      programId: cfg.programId || null,
      autoAttest: cfg.autoAttest,
      programConfigured: isProgramConfigured(),
    };
  } catch (err) {
    return {
      enabled: true,
      ok: false,
      cluster: cfg.cluster,
      error: err.message,
    };
  }
}
