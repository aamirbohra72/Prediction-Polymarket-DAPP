import { Router } from "express";
import { prisma } from "@repo/database";
import { requireAuth } from "../middleware/auth.js";
import { formatUser } from "../utils/helpers.js";
import {
  getSolanaConfig,
  getSolanaHealth,
  createLinkMessage,
  generateNonce,
  verifyWalletSignature,
  isValidPublicKey,
  explorerAddressUrl,
} from "@repo/solana";
import {
  formatSettlement,
  processPendingSettlements,
} from "../services/chainSettlement.js";
import { listOnChainMarkets, getMarketOnChainStatus } from "../services/onChainMarket.js";
import { isProgramConfigured } from "@repo/solana";
import {
  getCollateralOverview,
  confirmDeposit,
  processWithdrawal,
} from "../services/collateral.js";

const router = Router();

router.get("/config", (_req, res) => {
  const cfg = getSolanaConfig();
  res.json({
    enabled: cfg.enabled,
    cluster: cfg.cluster,
    rpcUrl: cfg.rpcUrl,
    programId: cfg.programId || null,
    autoAttest: cfg.autoAttest,
    autoSettle: cfg.autoSettle,
    autoInitMarkets: cfg.autoInitMarkets,
    programConfigured: isProgramConfigured(),
    explorerCluster: cfg.explorerCluster,
    usdcMint: cfg.usdcMint || null,
    collateralConfigured: Boolean(cfg.enabled && cfg.usdcMint && cfg.settlementSecret),
  });
});

router.get("/health", async (_req, res) => {
  const health = await getSolanaHealth();
  res.json(health);
});

router.get("/link-message", requireAuth, async (req, res) => {
  const cfg = getSolanaConfig();
  if (!cfg.enabled) {
    return res.status(400).json({ error: "Solana integration is disabled" });
  }

  const nonce = generateNonce();
  await prisma.user.update({
    where: { id: req.user.id },
    data: { solanaLinkNonce: nonce },
  });

  const message = createLinkMessage({
    appName: process.env.APP_NAME || "StockPredict",
    userId: req.user.id,
    nonce,
    cluster: cfg.cluster,
  });

  res.json({ message, nonce, cluster: cfg.cluster });
});

router.post("/link-wallet", requireAuth, async (req, res) => {
  const cfg = getSolanaConfig();
  if (!cfg.enabled) {
    return res.status(400).json({ error: "Solana integration is disabled" });
  }

  const { publicKey, signature, message } = req.body;
  if (!publicKey || !signature || !message) {
    return res.status(400).json({ error: "publicKey, signature, and message required" });
  }
  if (!isValidPublicKey(publicKey)) {
    return res.status(400).json({ error: "Invalid Solana public key" });
  }

  const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
  if (!fresh.solanaLinkNonce || !message.includes(fresh.solanaLinkNonce)) {
    return res.status(400).json({ error: "Stale link message — request a new one" });
  }

  const { valid } = verifyWalletSignature({ publicKeyBase58: publicKey, message, signatureBase58: signature });
  if (!valid) {
    return res.status(401).json({ error: "Invalid wallet signature" });
  }

  const taken = await prisma.user.findFirst({
    where: { walletAddress: publicKey, NOT: { id: req.user.id } },
  });
  if (taken) {
    return res.status(409).json({ error: "Wallet already linked to another account" });
  }

  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: {
      walletAddress: publicKey,
      solanaLinkNonce: null,
    },
  });

  await prisma.chainSettlement.create({
    data: {
      userId: user.id,
      type: "WALLET_LINK",
      status: "CONFIRMED",
      payload: { publicKey, cluster: cfg.cluster },
    },
  });

  res.json({
    user: formatUser(user),
    explorerUrl: explorerAddressUrl(publicKey),
  });
});

router.delete("/link-wallet", requireAuth, async (req, res) => {
  const user = await prisma.user.update({
    where: { id: req.user.id },
    data: { walletAddress: null, solanaLinkNonce: null },
  });
  res.json({ user: formatUser(user) });
});

router.get("/settlements", requireAuth, async (req, res) => {
  const rows = await prisma.chainSettlement.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  res.json({ settlements: rows.map(formatSettlement) });
});

router.post("/process-settlements", requireAuth, async (req, res) => {
  if (!req.user.isAdmin) {
    return res.status(403).json({ error: "Admin only" });
  }
  const result = await processPendingSettlements(20);
  res.json(result);
});

// --- Collateral vault (Phase 3: USDC deposit / withdraw) ---

router.get("/vault", requireAuth, async (req, res) => {
  try {
    const overview = await getCollateralOverview(req.user.id);
    res.json(overview);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post("/deposit", requireAuth, async (req, res) => {
  try {
    const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
    const result = await confirmDeposit({
      userId: req.user.id,
      walletAddress: fresh.walletAddress,
      signature: req.body.signature,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.post("/withdraw", requireAuth, async (req, res) => {
  try {
    const fresh = await prisma.user.findUnique({ where: { id: req.user.id } });
    const result = await processWithdrawal({
      userId: req.user.id,
      walletAddress: fresh.walletAddress,
      amount: req.body.amount,
    });
    res.json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get("/markets", async (_req, res) => {
  const markets = await listOnChainMarkets();
  res.json({ markets, programConfigured: isProgramConfigured() });
});

router.get("/markets/:marketId", async (req, res) => {
  const status = await getMarketOnChainStatus(req.params.marketId);
  res.json(status);
});

export default router;
