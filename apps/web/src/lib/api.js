const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

export { getToken };

export function setToken(token) {
  if (typeof window === "undefined") return;
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
  // Nav (in the root layout) only mounts once; tell it auth state changed
  // so it re-fetches the user after client-side login/logout navigation.
  window.dispatchEvent(new Event("auth-changed"));
}

async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

export const api = {
  health: () => request("/health"),
  platformStats: () => request("/stats"),
  register: (body) => request("/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body) => request("/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => request("/me"),
  updateProfile: (body) =>
    request("/me/profile", { method: "PATCH", body: JSON.stringify(body) }),
  myStats: () => request("/me/stats"),
  markets: (params = {}) => {
    const q = new URLSearchParams();
    if (params.status) q.set("status", params.status);
    if (params.symbol) q.set("symbol", params.symbol);
    if (params.sort) q.set("sort", params.sort);
    if (params.category) q.set("category", params.category);
    if (params.timeframe) q.set("timeframe", params.timeframe);
    if (params.watchlist) q.set("watchlist", "true");
    const qs = q.toString();
    return request(`/markets${qs ? `?${qs}` : ""}`);
  },
  marketFacets: () => request("/markets/facets"),
  leaderboard: () => request("/leaderboard"),
  activity: (limit = 40, type = "all") =>
    request(`/activity?limit=${limit}&type=${encodeURIComponent(type)}`),
  myActivity: (limit = 40) => request(`/me/activity?limit=${limit}`),
  myAnalytics: () => request("/me/analytics"),
  openOrders: () => request("/me/orders/open"),
  market: (id) => request(`/markets/${id}`),
  marketActivity: (id) => request(`/markets/${id}/activity`),
  marketComments: (id) => request(`/markets/${id}/comments`),
  postComment: (id, body, parentId = null) =>
    request(`/markets/${id}/comments`, {
      method: "POST",
      body: JSON.stringify({ body, parentId }),
    }),
  likeComment: (marketId, commentId) =>
    request(`/markets/${marketId}/comments/${commentId}/like`, { method: "POST" }),
  unlikeComment: (marketId, commentId) =>
    request(`/markets/${marketId}/comments/${commentId}/like`, { method: "DELETE" }),
  followUser: (userId) => request(`/me/follow/${userId}`, { method: "POST" }),
  unfollowUser: (userId) => request(`/me/follow/${userId}`, { method: "DELETE" }),
  following: () => request("/me/following"),
  placeOrder: (marketId, body) =>
    request(`/markets/${marketId}/orders`, {
      method: "POST",
      body: JSON.stringify({
        orderType: body.orderType || "LIMIT",
        ...body,
      }),
    }),
  cancelOrder: (id) => request(`/orders/${id}`, { method: "DELETE" }),
  portfolio: () => request("/me/portfolio"),
  positions: () => request("/me/positions"),
  transactions: () => request("/me/transactions"),
  orders: () => request("/me/orders"),
  notifications: () => request("/me/notifications"),
  readAllNotifications: () =>
    request("/me/notifications/read-all", { method: "PATCH" }),
  watchlist: () => request("/me/watchlist"),
  addWatchlist: (marketId) =>
    request(`/me/watchlist/${marketId}`, { method: "POST" }),
  removeWatchlist: (marketId) =>
    request(`/me/watchlist/${marketId}`, { method: "DELETE" }),
  alerts: () => request("/me/alerts"),
  createAlert: (body) =>
    request("/me/alerts", { method: "POST", body: JSON.stringify(body) }),
  deleteAlert: (id) => request(`/me/alerts/${id}`, { method: "DELETE" }),
  createMarket: (body) =>
    request("/admin/markets", { method: "POST", body: JSON.stringify(body) }),
  syncPolymarket: (body = {}) =>
    request("/admin/polymarket/sync", { method: "POST", body: JSON.stringify(body) }),
  polymarketStatus: () => request("/admin/polymarket/status"),
  adminStats: () => request("/admin/stats"),
  resolveMarket: (id) => request(`/admin/markets/${id}/resolve`, { method: "POST" }),
  closeMarket: (id) =>
    request(`/admin/markets/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: "CLOSED" }),
    }),
  resolveDueMarkets: () => request("/admin/markets/resolve-due", { method: "POST" }),
  testEmail: () => request("/admin/test-email", { method: "POST" }),
  solanaConfig: () => request("/solana/config"),
  solanaHealth: () => request("/solana/health"),
  solanaLinkMessage: () => request("/solana/link-message"),
  solanaLinkWallet: (body) =>
    request("/solana/link-wallet", { method: "POST", body: JSON.stringify(body) }),
  solanaUnlinkWallet: () => request("/solana/link-wallet", { method: "DELETE" }),
  solanaSettlements: () => request("/solana/settlements"),
  solanaVault: () => request("/solana/vault"),
  solanaDeposit: (signature) =>
    request("/solana/deposit", { method: "POST", body: JSON.stringify({ signature }) }),
  solanaWithdraw: (amount) =>
    request("/solana/withdraw", { method: "POST", body: JSON.stringify({ amount }) }),
  solanaMarkets: () => request("/solana/markets"),
  solanaMarketStatus: (marketId) => request(`/solana/markets/${marketId}`),
  adminOnChain: () => request("/admin/on-chain"),
  initMarketOnChain: (id) => request(`/admin/markets/${id}/on-chain`, { method: "POST" }),
  settleMarketOnChain: (id) =>
    request(`/admin/markets/${id}/on-chain/settle`, { method: "POST" }),
  syncAllMarketsOnChain: () =>
    request("/admin/markets/on-chain/sync-all", { method: "POST" }),
};

export function streamMarketUrl(marketId) {
  return `${API_URL}/stream/market/${marketId}`;
}

export function streamActivityUrl(type = "all", limit = 40) {
  return `${API_URL}/stream/activity?type=${encodeURIComponent(type)}&limit=${limit}`;
}
