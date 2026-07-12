# Advanced features guide

## Market vs limit orders

On any open market, the trade panel offers **LIMIT** (default) and **MARKET**.

- **Limit** — you set price 1–99¢; order rests on the book until matched.
- **Market** — fills immediately at the best available price:
  - Buy YES → best YES ask
  - Sell YES → best YES bid
  - (Same logic for NO book)

If there is no liquidity, the API returns an error. With `MINT_UNFILLED_ORDERS=true`, unfilled limit buys may still mint shares.

## Live activity feed

- **API:** `GET /activity?limit=40` (cached ~15s)
- **UI:** Nav → **Activity**
- Shows recent trades with masked emails and market links.

## Portfolio analytics

- **API:** `GET /me/analytics` (auth)
- **UI:** **Profile** page

Includes:

- Cash balance over time (from transactions)
- Exposure grouped by stock symbol
- Win rate on resolved markets
- Markets traded count

## Open orders

- **API:** `GET /me/orders/open`, `DELETE /orders/:id`
- **UI:** **Portfolio** → Open orders section
- Also cancel from market page sidebar.

## Related markets

Market detail shows other markets for the same `symbol` (e.g. other AAPL resolve dates).
