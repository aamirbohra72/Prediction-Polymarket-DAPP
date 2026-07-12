# StockPredict — Play-Money Prediction Markets

A Polymarket-style **stock prediction** app built as a Turborepo monorepo. Users trade **YES/NO** shares on binary questions like *"Will AAPL close above $200 on 2026-06-15?"* using **play money** ($10,000 starting balance).

## Tech stack

| Layer | Tech |
|-------|------|
| Monorepo | Turborepo + npm workspaces |
| API | Node.js, Express |
| Web | Next.js 15, React, Tailwind CSS v4 |
| Database | Neon (Postgres) + Prisma ORM |

## Project structure

```
apps/
  api/          Express REST API (port 4000)
  web/          Next.js frontend (port 3000)
packages/
  database/     Prisma schema & client
```

## Prerequisites

- Node.js 20+
- [Neon](https://neon.tech) account — create a project and copy `DATABASE_URL`
- [Finnhub](https://finnhub.io/register) API key (for market resolution)

## Setup

1. **Clone and install**

   ```bash
   cd Prediction-polymarket
   npm install
   ```

2. **Environment**

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set:

   - `DATABASE_URL` — from Neon dashboard
   - `JWT_SECRET` — any long random string
   - `ADMIN_EMAIL` — your admin login email
   - `FINNHUB_API_KEY` — from Finnhub

3. **Database**

   ```bash
   npm run db:generate
   npm run db:push
   npm run db:seed
   ```

   **Windows `EPERM` on `db:generate`:** Stop `npm run dev` first (any terminal running the API locks Prisma’s engine DLL). The project uses a safe generate script that retries automatically; if it still fails, close dev servers and run `npm run db:generate` again.

   Seed creates demo markets (AAPL, TSLA, NVDA) and an admin user.

4. **Run dev servers**

   ```bash
   npm run dev
   ```

   - Web: http://localhost:3000
   - API: http://localhost:4000

## Default admin (after seed)

- Email: value of `ADMIN_EMAIL` in `.env` (default `admin@example.com`)
- Password: `admin123`

Register a normal user from **Sign up** to get $10,000 play money.

## How it works (beginner)

1. **Markets** — Admin creates a question tied to a stock symbol, strike price, and resolve date.
2. **Trading** — Users buy YES or NO shares at 1–99¢. Price ≈ implied probability.
3. **Resolution** — Admin clicks **Resolve** (uses Finnhub daily close). Winners receive **$1 per share**.

## API overview

| Endpoint | Description |
|----------|-------------|
| `POST /auth/register` | Create account |
| `POST /auth/login` | Get JWT token |
| `GET /markets` | List markets |
| `POST /markets/:id/orders` | Place order (auth) |
| `GET /me/positions` | Your holdings |
| `POST /admin/markets` | Create market (admin) |
| `POST /admin/markets/:id/resolve` | Resolve market (admin) |

Send JWT as `Authorization: Bearer <token>`.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start API + web |
| `npm run build` | Build all apps |
| `npm run db:push` | Push Prisma schema to Neon |
| `npm run db:seed` | Seed demo data |

## Advanced features

| Feature | Description |
|---------|-------------|
| **Market orders** | Trade at best bid/ask (LIMIT still default) |
| **Live activity** | `/activity` — platform-wide trade feed |
| **Analytics** | Profile: balance chart, exposure by symbol, win rate |
| **Open orders** | Portfolio page — cancel resting limit orders |
| **Related markets** | Same symbol linked on market detail |
| **Live stock quote** | Finnhub price on open markets |

## Solana / Web3 (optional)

Hybrid on-chain settlement on devnet. Full roadmap: [docs/SOLANA-ROADMAP.md](docs/SOLANA-ROADMAP.md).

**Homepage markets come from Neon + Redis, not Solana.** See [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md).

```env
SOLANA_ENABLED=false
SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
```

Nav → **Web3** to connect Phantom and link wallet. Anchor program in `onchain/`.

## Email notifications (Brevo)

Transactional email on trades, resolutions, price alerts, and signup. See [docs/EMAIL.md](docs/EMAIL.md).

```env
BREVO_API_KEY=your_key
BREVO_SENDER_EMAIL=verified-sender@yourdomain.com
EMAIL_NOTIFICATIONS_ENABLED=true
```

## Kafka (optional — senior / scale)

Event-driven worker for async notifications and cache invalidation. **Not required** for normal use.

- Beginner guide: [docs/KAFKA-GUIDE.md](docs/KAFKA-GUIDE.md)
- Enable: `docker compose up -d` then `KAFKA_ENABLED=true` in `.env`
- Run: `npm run dev` (starts API + web + worker)

## Redis caching (scalability)

Leaderboard and portfolio responses are cached in **Redis** when `REDIS_URL` is set. If Redis is down, the API falls back to Postgres (no errors).

| Key | TTL (default) | Invalidated when |
|-----|---------------|------------------|
| `cache:leaderboard:v1` | 60s | Trades, resolutions |
| `cache:portfolio:bundle:{userId}` | 30s | User trades, profile update |
| `cache:user:stats:{userId}` | 30s | Same as portfolio |

**Upstash (recommended for production):**

1. In [Upstash Console](https://console.upstash.com/redis) click **+ Create Database**
2. Pick a region close to your Neon DB (e.g. `ap-southeast-1`)
3. Open the database → **Connect** → copy **REST URL** and **REST TOKEN**
4. Paste into `.env`:

```env
UPSTASH_REDIS_REST_URL=https://YOUR_DB.upstash.io
UPSTASH_REDIS_REST_TOKEN=your_token_here
CACHE_LEADERBOARD_TTL=60
CACHE_PORTFOLIO_TTL=30
```

The API uses `@upstash/redis` over HTTPS (best for Upstash + firewalls). Optional `REDIS_URL` (`rediss://...`) is TCP fallback via ioredis.

5. Restart API: `npm run dev` — log should show `[redis] Using Upstash REST (HTTPS)`
6. Check: http://localhost:4000/health → `"redis": true`, `"redisMode": "upstash-rest"`

**Local Redis (optional dev):**

```bash
docker run -d --name stockpredict-redis -p 6379:6379 redis:7-alpine
```

```env
REDIS_URL=redis://localhost:6379
```

Portfolio page uses a single cached endpoint: `GET /me/portfolio`.

## Advanced features (v3)

- **Watchlist** — star markets; `/watchlist` page
- **Notifications** — trades, resolutions, price alerts (bell in nav)
- **Price alerts** — notify when YES crosses a target (checked every 5 min)
- **Live stock quotes** — Finnhub quote on market page (when `FINNHUB_API_KEY` set)
- **SSE live stream** — order book & chart update every 3s without full page reload
- **Market comments & activity feed**
- **User profile** — display name, P&L stats (`/profile`)
- **Portfolio P&L** — portfolio value, mark-to-market on positions
- **Platform stats** — traders, volume on home page
- **Admin analytics** — dashboard metrics on Admin page
- **Light/dark theme** toggle
- **Open interest** per market
- **Cancel open orders** from market page

## Advanced features (v2)

- **Order book depth** — aggregated bids/asks per outcome on each market page
- **Buy & sell** — exit positions by selling YES/NO shares
- **Price chart** — YES probability history from trades and snapshots
- **Live updates** — market page polls every 4 seconds while open
- **Filters** — search by symbol, filter by status, sort by volume/price/date
- **Leaderboard** — top balances, trade count, resolved wins
- **Auto scheduler** — hourly close/resolve for due markets (`ENABLE_SCHEDULER=true`)
- **Admin bulk resolve** — “Run auto close & resolve” on Admin page

Optional env: `MINT_UNFILLED_ORDERS=false` for a pure order book (orders rest until matched).

## Disclaimer

**Play money only.** Not financial advice. Not a real brokerage. Stock prices from third-party APIs.

## License

MIT
