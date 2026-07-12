import { prisma } from "@repo/database";
import {
  getSolanaConfig,
  isProgramConfigured,
  initializeMarketOnChain,
  settleMarketOnChain,
  fetchOnChainMarketAccount,
  explorerAddressUrl,
  explorerTxUrl,
} from "@repo/solana";

function assertProgramReady() {
  const cfg = getSolanaConfig();
  if (!cfg.enabled) throw new Error("Solana is disabled (SOLANA_ENABLED=false)");
  if (!isProgramConfigured()) {
    throw new Error(
      "Program not configured — set SOLANA_PROGRAM_ID and SOLANA_SETTLEMENT_SECRET (see onchain/README.md)"
    );
  }
}

export async function getMarketOnChainStatus(marketId) {
  const cfg = getSolanaConfig();
  if (!cfg.enabled || !cfg.programId) {
    return { enabled: false, synced: false };
  }

  const dbRecord = await prisma.onChainMarket.findUnique({ where: { marketId } });
  let live = null;
  try {
    live = await fetchOnChainMarketAccount(marketId);
  } catch (err) {
    return {
      enabled: true,
      synced: Boolean(dbRecord),
      dbRecord,
      error: err.message,
    };
  }

  return {
    enabled: true,
    synced: Boolean(dbRecord || live),
    pda: live?.pda ?? dbRecord?.pda ?? null,
    programId: cfg.programId,
    explorerUrl: live?.pda ? explorerAddressUrl(live.pda) : null,
    onChain: live,
    dbRecord,
  };
}

export async function registerMarketOnChain(marketId) {
  assertProgramReady();

  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) throw new Error("Market not found");

  const existing = await prisma.onChainMarket.findUnique({ where: { marketId } });
  if (existing) {
    const live = await fetchOnChainMarketAccount(marketId);
    return { market: formatOnChainRecord(existing, live), alreadySynced: true };
  }

  const result = await initializeMarketOnChain({
    marketId: market.id,
    strike: market.strike,
    resolveDate: market.resolveDate,
  });

  const cfg = getSolanaConfig();
  const record = await prisma.onChainMarket.create({
    data: {
      marketId: market.id,
      pda: result.pda,
      programId: cfg.programId,
      cluster: cfg.cluster,
      txSignature: result.signature,
    },
  });

  if (!result.alreadyExists && result.signature) {
    await prisma.chainSettlement.create({
      data: {
        marketId: market.id,
        type: "MARKET_INITIALIZED",
        status: "CONFIRMED",
        txSignature: result.signature,
        payload: {
          pda: result.pda,
          strikeCents: result.strikeCents,
          resolveTs: result.resolveTs,
        },
      },
    });
  }

  const live = await fetchOnChainMarketAccount(marketId);
  return {
    market: formatOnChainRecord(record, live),
    alreadySynced: result.alreadyExists,
    explorerUrl: result.explorerUrl,
  };
}

export async function settleMarketOnChainRecord(marketId, winningOutcome) {
  assertProgramReady();

  const market = await prisma.market.findUnique({ where: { id: marketId } });
  if (!market) throw new Error("Market not found");
  if (market.status !== "RESOLVED") {
    throw new Error("Market must be resolved off-chain before on-chain settle");
  }

  const onChain = await prisma.onChainMarket.findUnique({ where: { marketId } });
  if (!onChain) {
    throw new Error("Market not on-chain — initialize first");
  }

  const outcome = winningOutcome || market.winningOutcome;
  if (!outcome) throw new Error("No winning outcome");

  const result = await settleMarketOnChain({ marketId, winningOutcome: outcome });

  if (!result.alreadySettled && result.signature) {
    await prisma.chainSettlement.create({
      data: {
        marketId,
        type: "ONCHAIN_MARKET_SETTLED",
        status: "CONFIRMED",
        txSignature: result.signature,
        payload: { winningOutcome: outcome, pda: result.pda },
      },
    });
  }

  return {
    pda: result.pda,
    winningOutcome: outcome,
    alreadySettled: result.alreadySettled,
    explorerUrl: result.explorerUrl,
  };
}

export async function syncAllMarketsOnChain() {
  const markets = await prisma.market.findMany({
    where: { status: { in: ["OPEN", "CLOSED"] } },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const market of markets) {
    const synced = await prisma.onChainMarket.findUnique({ where: { marketId: market.id } });
    if (synced) {
      results.push({ marketId: market.id, symbol: market.symbol, status: "skipped" });
      continue;
    }
    try {
      const r = await registerMarketOnChain(market.id);
      results.push({
        marketId: market.id,
        symbol: market.symbol,
        status: r.alreadySynced ? "exists" : "initialized",
        pda: r.market.pda,
      });
    } catch (err) {
      results.push({ marketId: market.id, symbol: market.symbol, status: "error", error: err.message });
    }
  }
  return results;
}

export async function listOnChainMarkets() {
  const cfg = getSolanaConfig();
  const markets = await prisma.market.findMany({ orderBy: { createdAt: "desc" } });
  const records = await prisma.onChainMarket.findMany();
  const byMarket = new Map(records.map((r) => [r.marketId, r]));
  const canFetchLive = Boolean(cfg.enabled && cfg.programId && cfg.settlementSecret);

  return Promise.all(
    markets.map(async (m) => {
      const rec = byMarket.get(m.id);
      let live = null;
      if (canFetchLive) {
        try {
          live = await fetchOnChainMarketAccount(m.id);
        } catch {
          live = null;
        }
      }
      return {
        marketId: m.id,
        symbol: m.symbol,
        title: m.title,
        status: m.status,
        synced: Boolean(rec || live),
        pda: rec?.pda ?? live?.pda ?? null,
        programId: cfg.programId || rec?.programId || null,
        explorerUrl: (rec?.pda || live?.pda) ? explorerAddressUrl(rec?.pda || live.pda) : null,
        onChain: live,
      };
    })
  );
}

function formatOnChainRecord(record, live) {
  return {
    marketId: record.marketId,
    pda: record.pda,
    programId: record.programId,
    cluster: record.cluster,
    txSignature: record.txSignature,
    initExplorerUrl: record.txSignature ? explorerTxUrl(record.txSignature) : null,
    pdaExplorerUrl: explorerAddressUrl(record.pda),
    onChain: live,
    createdAt: record.createdAt,
  };
}

/** Called after off-chain resolution when SOLANA_AUTO_SETTLE=true */
export async function autoSettleAfterResolve(marketId, winningOutcome) {
  const cfg = getSolanaConfig();
  if (!cfg.autoSettle || !isProgramConfigured()) return null;

  const onChain = await prisma.onChainMarket.findUnique({ where: { marketId } });
  if (!onChain) return null;

  try {
    return await settleMarketOnChainRecord(marketId, winningOutcome);
  } catch (err) {
    console.warn("[solana] auto-settle:", err.message);
    return { error: err.message };
  }
}

/** Called after admin creates market when SOLANA_AUTO_INIT_MARKETS=true */
export async function autoInitAfterCreate(marketId) {
  const cfg = getSolanaConfig();
  if (!cfg.autoInitMarkets || !isProgramConfigured()) return null;
  try {
    return await registerMarketOnChain(marketId);
  } catch (err) {
    console.warn("[solana] auto-init:", err.message);
    return { error: err.message };
  }
}
