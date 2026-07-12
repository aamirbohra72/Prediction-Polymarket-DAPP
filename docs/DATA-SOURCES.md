# Where homepage data comes from

## Short answer

| UI piece | Source | Solana? |
|----------|--------|---------|
| Market cards, titles, Yes/No % rings | **Neon Postgres** via Express API | No |
| Volume / open interest | **Neon** (trades + positions) | No |
| Price history line chart | **Neon** `PriceSnapshot` | No |
| Faster market list | **Upstash Redis** cache (optional) | No |
| Live stock quote on detail page | **Finnhub** | No |
| Wallet connect / Web3 page | **Solana RPC (devnet)** | Yes |
| On-chain market PDA / settle | Solana program (Phase 2+) | Yes |

**Polymarket-style cards cannot come from “Solana API” alone.** Solana RPC does not publish stock prediction markets. Real Polymarket indexes its own off-chain / indexer data; we do the same with Neon.

---

## Recommended stack (what you already have)

```
Browser → Next.js → Express API → Neon (source of truth)
                              ↘ Upstash Redis (cache)
                              ↘ Finnhub (stock close/quote)
                              ↘ Solana (wallet + settlement only)
```

### What you need to provide (free tiers)

1. **Neon** — `DATABASE_URL` (you have this)  
2. **Upstash Redis** — `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` (you have this; REST is preferred on Windows)  
3. **Finnhub** — free key at https://finnhub.io/register → `FINNHUB_API_KEY`  
4. **Solana (optional)** — free **devnet** RPC: `https://api.devnet.solana.com`  
   - No paid Solana API required for Phase 1–2  
   - For production traffic later: free tiers of Helius / QuickNode  

You do **not** need a paid “Solana markets API” for this clone.

---

## Make content show up

```bash
npm run db:seed
npm run dev
```

Seed creates ~14 stock markets + chart history in Neon. Cards and rings read that data live.

---

## Enable Redis cache for markets

Keep Upstash REST vars set. Public `GET /markets` responses are cached ~60s. After trades, cache is invalidated.

If Redis fails, the API still serves Neon directly (no hard dependency).

---

## When Solana data appears

Set later (after program deploy):

```env
SOLANA_ENABLED=true
SOLANA_PROGRAM_ID=...
SOLANA_SETTLEMENT_SECRET=...
```

Then Admin can register markets on-chain. Homepage still lists from Neon; Web3 page shows PDAs / Solscan links.
