# StockPredict on-chain program (Anchor)

Phase 2 of [docs/SOLANA-ROADMAP.md](../docs/SOLANA-ROADMAP.md).

## Prerequisites

- [Rust](https://rustup.rs/)
- [Solana CLI](https://solana.com/docs/intro/installation)
- [Anchor 0.31](https://www.anchor-lang.com/docs/installation)

## 1. Deploy to devnet

```bash
cd onchain
solana config set --url devnet
solana airdrop 2
anchor build
anchor deploy --provider.cluster devnet
```

Copy the **Program Id** from the deploy output.

## 2. Configure `.env` (repo root)

```env
SOLANA_ENABLED=true
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_PROGRAM_ID=<paste program id>
SOLANA_SETTLEMENT_SECRET=<base58 secret of funded devnet keypair>
SOLANA_AUTO_INIT_MARKETS=false
SOLANA_AUTO_SETTLE=true
```

Generate/export settlement keypair (pays tx fees as program authority):

```bash
solana-keygen new -o settlement-devnet.json
solana address -k settlement-devnet.json
solana airdrop 2 $(solana address -k settlement-devnet.json) --url devnet
# Base58 secret for .env:
node -e "console.log(require('bs58').encode(require('fs').readFileSync('settlement-devnet.json')))"
```

**Important:** The settlement wallet must match the keypair used to deploy the program (or be set as `market.authority` when initializing). Simplest path: use the same wallet for deploy + `SOLANA_SETTLEMENT_SECRET`.

## 3. Sync program id in source (optional, for rebuilds)

```bash
anchor keys sync
```

Updates `declare_id!` in `programs/stockpredict/src/lib.rs` and `Anchor.toml`.

## 4. Register markets from Admin UI

1. `npm run dev`
2. Admin → **Solana Phase 2** → **Register on-chain** per market, or **Sync all**

Or API:

```bash
POST /admin/markets/:id/on-chain
POST /admin/markets/on-chain/sync-all
POST /admin/markets/:id/on-chain/settle   # after off-chain resolve
```

## Program instructions

| Instruction | Purpose |
|-------------|---------|
| `initialize_market` | Create Market PDA from off-chain market id hash |
| `settle_market` | Mark market resolved with winning YES/NO on-chain |

## Verify on Solscan

- Market PDA: `https://solscan.io/account/<PDA>?cluster=devnet`
- Init tx: linked from Admin / Web3 pages

## References

- [Solana quick start](https://solana.com/docs/intro/quick-start)
- [Solana RPC](https://solana.com/docs/rpc)
- [Anchor docs](https://www.anchor-lang.com/docs)
