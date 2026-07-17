import { prisma } from "@repo/database";
import { formatMarket, maskEmail, toNumber } from "../utils/helpers.js";
import { cacheGet, cacheSet, cacheDel } from "@repo/platform/redis";

const CACHE_PREFIX = "cache:activity:global:v3";
const TTL = 10;

/** Quantity at/above this counts as a whale trade highlight. */
export const WHALE_QTY = 40;
/** Resting order size that surfaces as a "large order" event. */
export const LARGE_ORDER_QTY = 50;
/** Absolute ¢ move that counts as a chance spike. */
export const CHANCE_MOVE_CENTS = 5;

const PUBLIC_TYPES = new Set([
  "all",
  "trade",
  "comment",
  "resolution",
  "market",
  "order",
  "deposit",
  "alert",
  "highlight",
  "following",
  "mine",
]);

function actorName(user) {
  if (!user) return "Someone";
  return user.displayName || maskEmail(user.email);
}

function tradeHref(marketId, { outcome, side, priceCents, quantity } = {}) {
  const q = new URLSearchParams();
  if (outcome) q.set("outcome", outcome);
  if (side) q.set("side", side);
  if (priceCents != null) q.set("price", String(priceCents));
  if (quantity != null) q.set("qty", String(quantity));
  q.set("type", "LIMIT");
  const qs = q.toString();
  return `/markets/${marketId}${qs ? `?${qs}` : ""}`;
}

/**
 * @param {object} opts
 * @param {number} [opts.limit]
 * @param {string} [opts.type]
 * @param {string|null} [opts.userId] — for mine / following
 */
export async function getGlobalActivity({
  limit = 40,
  type = "all",
  userId = null,
} = {}) {
  const safeType = PUBLIC_TYPES.has(type) ? type : "all";
  const take = Math.min(Math.max(Number(limit) || 40, 1), 80);

  // Personalized feeds skip shared cache
  const useCache = !userId && safeType !== "mine" && safeType !== "following";
  const cacheKey = `${CACHE_PREFIX}:${safeType}:${take}`;
  if (useCache) {
    const cached = await cacheGet(cacheKey);
    if (cached) return cached;
  }

  const feed = [];
  const want = (t) =>
    safeType === "all" ||
    safeType === "highlight" ||
    safeType === "mine" ||
    safeType === "following" ||
    safeType === t;

  // --- Trades ---
  if (want("trade") || safeType === "highlight") {
    const tradeWhere =
      safeType === "mine" && userId
        ? { OR: [{ buyerId: userId }, { sellerId: userId }] }
        : safeType === "following" && userId
          ? await followingTradeWhere(userId)
          : safeType === "highlight"
            ? { quantity: { gte: WHALE_QTY } }
            : {};

    if (tradeWhere !== null) {
      const trades = await prisma.trade.findMany({
        where: tradeWhere,
        orderBy: { createdAt: "desc" },
        take,
        include: {
          market: true,
          buyer: { select: { id: true, displayName: true, email: true } },
          seller: { select: { id: true, displayName: true, email: true } },
        },
      });
      for (const t of trades) {
        const whale = t.quantity >= WHALE_QTY;
        if (safeType === "highlight" && !whale) continue;
        feed.push({
          id: `trade-${t.id}`,
          type: "trade",
          highlight: whale ? "whale" : null,
          at: t.createdAt,
          market: formatMarket(t.market),
          outcome: t.outcome,
          priceCents: t.priceCents,
          quantity: t.quantity,
          buyer: actorName(t.buyer),
          seller: actorName(t.seller),
          buyerId: t.buyerId,
          sellerId: t.sellerId,
          text: whale
            ? `🐋 Whale · ${t.quantity} ${t.outcome} @ ${t.priceCents}¢`
            : `${t.quantity} ${t.outcome} @ ${t.priceCents}¢`,
          href: tradeHref(t.marketId, {
            outcome: t.outcome,
            side: "BUY",
            priceCents: t.priceCents,
            quantity: t.quantity,
          }),
        });
      }
    }
  }

  // --- Comments (top-level only in feed) ---
  if (want("comment") && safeType !== "highlight") {
    const commentWhere =
      safeType === "mine" && userId
        ? { userId, parentId: null }
        : safeType === "following" && userId
          ? await followingCommentWhere(userId)
          : { parentId: null };

    if (commentWhere !== null) {
      const comments = await prisma.marketComment.findMany({
        where: commentWhere,
        orderBy: { createdAt: "desc" },
        take,
        include: {
          market: true,
          user: { select: { id: true, displayName: true, email: true } },
          _count: { select: { likes: true, replies: true } },
        },
      });
      for (const c of comments) {
        const mention = extractMention(c.body);
        feed.push({
          id: `comment-${c.id}`,
          type: "comment",
          highlight: mention ? "mention" : null,
          at: c.createdAt,
          market: formatMarket(c.market),
          author: actorName(c.user),
          authorId: c.userId,
          text: c.body,
          likeCount: c._count.likes,
          replyCount: c._count.replies,
          href: `/markets/${c.marketId}#discussion`,
        });
      }
    }
  }

  // --- Resolutions ---
  if (
    (want("resolution") || safeType === "all") &&
    safeType !== "mine" &&
    safeType !== "following" &&
    safeType !== "highlight"
  ) {
    const resolved = await prisma.market.findMany({
      where: { status: "RESOLVED" },
      orderBy: { resolveDate: "desc" },
      take: Math.min(take, 20),
    });
    for (const m of resolved) {
      const price = m.resolvedPrice != null ? toNumber(m.resolvedPrice) : null;
      feed.push({
        id: `resolution-${m.id}`,
        type: "resolution",
        at: m.resolveDate,
        market: formatMarket(m),
        winningOutcome: m.winningOutcome,
        text: `Resolved ${m.winningOutcome || "—"}${price != null ? ` · spot $${price}` : ""}`,
        href: `/markets/${m.id}`,
      });
    }
  }

  // --- New markets ---
  if (
    (want("market") || safeType === "all") &&
    safeType !== "mine" &&
    safeType !== "following" &&
    safeType !== "highlight"
  ) {
    const markets = await prisma.market.findMany({
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 15),
    });
    for (const m of markets) {
      feed.push({
        id: `market-${m.id}`,
        type: "market",
        at: m.createdAt,
        market: formatMarket(m),
        text: `New market · ${m.title}`,
        href: `/markets/${m.id}`,
      });
    }
  }

  // --- Large resting orders ---
  if (
    (want("order") || safeType === "all" || safeType === "highlight") &&
    safeType !== "following"
  ) {
    const orderWhere = {
      status: "OPEN",
      quantity: { gte: LARGE_ORDER_QTY },
      ...(safeType === "mine" && userId ? { userId } : {}),
    };
    const orders = await prisma.order.findMany({
      where: orderWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 25),
      include: {
        market: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    for (const o of orders) {
      const rem = o.quantity - o.filledQty;
      if (rem <= 0) continue;
      feed.push({
        id: `order-${o.id}`,
        type: "order",
        highlight: "large_order",
        at: o.createdAt,
        market: formatMarket(o.market),
        author: actorName(o.user),
        authorId: o.userId,
        outcome: o.outcome,
        side: o.side,
        priceCents: o.priceCents,
        quantity: rem,
        text: `Large ${o.side} ${o.outcome} · ${rem} @ ${o.priceCents}¢`,
        href: tradeHref(o.marketId, {
          outcome: o.outcome,
          side: o.side === "BUY" ? "SELL" : "BUY",
          priceCents: o.priceCents,
          quantity: Math.min(rem, 20),
        }),
      });
    }
  }

  // --- Deposits / withdrawals ---
  if (
    (want("deposit") || safeType === "all" || safeType === "mine") &&
    safeType !== "following" &&
    safeType !== "highlight"
  ) {
    const txWhere = {
      type: { in: ["WALLET_DEPOSIT", "WALLET_WITHDRAWAL", "DEPOSIT_INITIAL"] },
      ...(safeType === "mine" && userId ? { userId } : {}),
    };
    const txs = await prisma.transaction.findMany({
      where: txWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 20),
      include: { user: { select: { id: true, displayName: true, email: true } } },
    });
    for (const t of txs) {
      const amt = toNumber(t.amount);
      const label =
        t.type === "WALLET_WITHDRAWAL"
          ? "Withdrawal"
          : t.type === "WALLET_DEPOSIT"
            ? "Deposit"
            : "Welcome credit";
      feed.push({
        id: `tx-${t.id}`,
        type: "deposit",
        at: t.createdAt,
        author: actorName(t.user),
        authorId: t.userId,
        text: `${label} · $${Math.abs(amt).toFixed(2)}`,
        href: "/portfolio",
      });
    }
  }

  // --- Price alerts (triggered) ---
  if (
    (want("alert") || safeType === "all" || safeType === "mine") &&
    safeType !== "following" &&
    safeType !== "highlight"
  ) {
    const alertWhere = {
      triggered: true,
      ...(safeType === "mine" && userId ? { userId } : {}),
    };
    const alerts = await prisma.priceAlert.findMany({
      where: alertWhere,
      orderBy: { createdAt: "desc" },
      take: Math.min(take, 15),
      include: {
        market: true,
        user: { select: { id: true, displayName: true, email: true } },
      },
    });
    for (const a of alerts) {
      feed.push({
        id: `alert-${a.id}`,
        type: "alert",
        at: a.createdAt,
        market: formatMarket(a.market),
        author: actorName(a.user),
        text: `Alert · YES ${a.direction.toLowerCase()} ${a.targetCents}¢`,
        href: `/markets/${a.marketId}`,
      });
    }
  }

  // --- Chance / volume spikes from price history ---
  if (
    (safeType === "all" || safeType === "highlight") &&
    safeType !== "mine" &&
    safeType !== "following"
  ) {
    const snaps = await prisma.priceSnapshot.findMany({
      orderBy: { createdAt: "desc" },
      take: 80,
      include: { market: true },
    });
    const byMarket = new Map();
    for (const s of snaps) {
      if (!byMarket.has(s.marketId)) byMarket.set(s.marketId, []);
      const arr = byMarket.get(s.marketId);
      if (arr.length < 2) arr.push(s);
    }
    for (const [marketId, pair] of byMarket) {
      if (pair.length < 2) continue;
      const [newer, older] = pair;
      const move = newer.yesPriceCents - older.yesPriceCents;
      const volSpike = newer.volume >= 30 && newer.volume > (older.volume || 0) * 2;
      if (Math.abs(move) < CHANCE_MOVE_CENTS && !volSpike) continue;
      feed.push({
        id: `move-${marketId}-${newer.id}`,
        type: "highlight",
        highlight: Math.abs(move) >= CHANCE_MOVE_CENTS ? "chance_move" : "volume_spike",
        at: newer.createdAt,
        market: formatMarket(newer.market),
        text:
          Math.abs(move) >= CHANCE_MOVE_CENTS
            ? `Chance ${move > 0 ? "↑" : "↓"} ${Math.abs(move)}¢ → ${newer.yesPriceCents}%`
            : `Volume spike · ${newer.volume} shares`,
        href: `/markets/${marketId}`,
      });
    }
  }

  // Personalized: if mine/following and nothing matched types, still ok
  feed.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  const sliced = feed.slice(0, take);

  if (useCache) await cacheSet(cacheKey, sliced, TTL);
  return sliced;
}

async function followingIds(userId) {
  const rows = await prisma.userFollow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  });
  return rows.map((r) => r.followingId);
}

async function followingTradeWhere(userId) {
  const ids = await followingIds(userId);
  if (!ids.length) return null;
  return { OR: [{ buyerId: { in: ids } }, { sellerId: { in: ids } }] };
}

async function followingCommentWhere(userId) {
  const ids = await followingIds(userId);
  if (!ids.length) return null;
  return { userId: { in: ids }, parentId: null };
}

function extractMention(body) {
  const m = String(body || "").match(/@([a-zA-Z0-9_]{2,32})/);
  return m ? m[1] : null;
}

export async function getPersonalActivity(userId, limit = 40) {
  return getGlobalActivity({ limit, type: "mine", userId });
}

export async function invalidateActivityCache() {
  const types = [
    "all",
    "trade",
    "comment",
    "resolution",
    "market",
    "order",
    "deposit",
    "alert",
    "highlight",
  ];
  const limits = [40, 50, 80];
  const keys = ["cache:activity:global:v1", "cache:activity:global:v2"];
  for (const t of types) {
    for (const n of limits) {
      keys.push(`cache:activity:global:v2:${t}:${n}`);
      keys.push(`${CACHE_PREFIX}:${t}:${n}`);
    }
  }
  await cacheDel(...keys);
}
