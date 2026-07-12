/** Kafka topic names for StockPredict */
export const TOPICS = {
  TRADES: "stockpredict.trades",
  MARKETS: "stockpredict.markets",
  USERS: "stockpredict.users",
};

export const EVENT_TYPES = {
  TRADE_EXECUTED: "trade.executed",
  MARKET_RESOLVED: "market.resolved",
  ORDER_PLACED: "order.placed",
  MARKET_CREATED: "market.created",
};
