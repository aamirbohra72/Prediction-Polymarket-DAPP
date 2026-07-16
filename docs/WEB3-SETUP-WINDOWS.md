# Web3 Setup (Windows) — Solana devnet + USDC vault

This guide gets your machine ready to run the on-chain (Phase 3) features:
**wallet deposit → on-chain USDC vault → tradeable balance**.

Everything here uses **devnet** (free, fake money). Nothing costs real funds.

---

## 0. What you'll end up with

- `solana` + `anchor` CLI installed
- A **devnet authority keypair** (the platform "operator" wallet) — funded with devnet SOL
- A **devnet USDC-style SPL token** (you mint it yourself, so faucets can't run dry)
- A browser wallet (**Phantom** or **Backpack**) switched to devnet, holding some of that USDC
- `.env` filled in so the API can custody deposits and send withdrawals

> **Custody model (MVP):** the vault is a token account owned by your operator
> keypair (`SOLANA_SETTLEMENT_SECRET`). Deposits are real on-chain USDC transfers
> the user signs with their wallet; withdrawals are real on-chain transfers the
> operator signs back to the user. This is the "hybrid CEX" model (Backpack/CoinDCX
> style). The upgrade path to a non-custodial **program-owned PDA escrow**
> (Polymarket style) is noted at the end.

---

## 1. Install the Solana CLI (Windows)

Open **PowerShell** and run:

```powershell
cmd /c "curl https://release.anza.xyz/stable/install | powershell -"
```

If that URL is blocked, use the Windows installer approach:

```powershell
cmd /c "curl https://release.anza.xyz/stable/solana-install-init-x86_64-pc-windows-msvc.exe --output C:\solana-install-tmp\solana-install-init.exe --create-dirs"
C:\solana-install-tmp\solana-install-init.exe stable
```

Close and reopen PowerShell, then verify:

```powershell
solana --version
```

Set the cluster to devnet:

```powershell
solana config set --url https://api.devnet.solana.com
```

> **Tip:** the public devnet RPC is rate-limited. For fewer errors, get a free
> devnet endpoint from [Helius](https://helius.dev) or [QuickNode](https://quicknode.com)
> and use it as `SOLANA_RPC_URL`.

---

## 2. Create + fund the operator keypair

This keypair is your platform authority and vault owner.

```powershell
solana-keygen new --outfile "$env:USERPROFILE\.config\solana\operator.json"
solana config set --keypair "$env:USERPROFILE\.config\solana\operator.json"
solana address
solana airdrop 2
solana balance
```

If `airdrop` is throttled, use the web faucet at https://faucet.solana.com
(paste the address from `solana address`).

### Export it for `.env`

The app expects a **base58** secret string in `SOLANA_SETTLEMENT_SECRET`.
Run this helper from the repo root (Node is already installed):

```powershell
node scripts/export-keypair.js "$env:USERPROFILE\.config\solana\operator.json"
```

Copy the printed base58 string into `.env` as `SOLANA_SETTLEMENT_SECRET=...`.

---

## 3. Create your devnet "USDC" token

Install the SPL token CLI and create a 6-decimal token (USDC uses 6 decimals):

```powershell
cargo install spl-token-cli   # or: solana install (spl-token ships with some installs)
spl-token create-token --decimals 6
```

Copy the printed **mint address** → this is your `SOLANA_USDC_MINT`.

Create a token account for yourself and mint some test balance:

```powershell
spl-token create-account <MINT_ADDRESS>
spl-token mint <MINT_ADDRESS> 1000
spl-token balance <MINT_ADDRESS>
```

> Prefer Circle's official devnet USDC? Its mint is
> `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgtQ...` (verify current value in Circle's
> docs). You can set that as `SOLANA_USDC_MINT` instead, but then you must obtain
> devnet USDC from Circle's faucet. Minting your own token is the most reliable.

### Send some test USDC to your browser wallet

Get your Phantom/Backpack **devnet** address (step 5), then:

```powershell
spl-token transfer <MINT_ADDRESS> 500 <YOUR_PHANTOM_ADDRESS> --fund-recipient --allow-unfunded-recipient
```

---

## 4. Install Anchor (only needed for the market program / future PDA escrow)

Phase 3 deposits/withdrawals work **without** redeploying the program (operator
vault). You only need Anchor for the existing market PDA program (Phase 2) and the
future PDA-escrow upgrade.

```powershell
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest
anchor --version
```

> Anchor's toolchain is smoother on **WSL/Linux**. If you hit Rust/BPF build
> issues on native Windows, install WSL (`wsl --install`) and run `anchor build`
> there. Deposits/withdrawals don't need this.

---

## 5. Browser wallet (Phantom or Backpack)

1. Install [Phantom](https://phantom.app) or [Backpack](https://backpack.app).
2. Settings → **Developer settings → change network to Devnet**.
3. Copy your address; fund it with devnet SOL (`solana airdrop 1 <ADDRESS>`) and
   test USDC (step 3).

---

## 6. Fill in `.env`

```env
# Turn Web3 on
SOLANA_ENABLED=true
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com   # or your Helius/QuickNode URL
NEXT_PUBLIC_SOLANA_CLUSTER=devnet
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# Operator authority + vault owner (base58 from step 2)
SOLANA_SETTLEMENT_SECRET=<base58-secret>

# Your devnet USDC token (step 3)
SOLANA_USDC_MINT=<mint-address>
SOLANA_USDC_DECIMALS=6

# Existing market program (Phase 2) — optional for deposits
SOLANA_PROGRAM_ID=<program-id-if-deployed>
```

Restart the API and web dev servers.

---

## 7. Try it

1. Open the app → **Web3** page → connect Phantom/Backpack (devnet).
2. Click **Sign & link wallet** (proves you own the address).
3. In **Collateral**, enter an amount and click **Deposit** — approve in wallet.
   - This sends real devnet USDC to the vault; the API verifies the on-chain
     transfer and credits your tradeable balance.
4. Trade markets as usual (balance now backed by on-chain USDC).
5. Click **Withdraw** — the operator sends USDC back to your wallet on-chain.

Every deposit/withdrawal shows a Solscan link.

---

## What I need from you (checklist)

- [ ] `solana --version` works
- [ ] Operator address funded with devnet SOL, base58 secret in `.env`
- [ ] `SOLANA_USDC_MINT` set (your minted token or Circle devnet USDC)
- [ ] Phantom/Backpack on **devnet** holding some of that USDC
- [ ] `SOLANA_ENABLED=true` and servers restarted

Paste me any errors from the API console or the Web3 page and I'll debug.

---

## Upgrade path → non-custodial PDA escrow (Polymarket style)

The current vault is operator-owned. To make it fully trustless:

1. Add `deposit_collateral` / `withdraw_collateral` instructions to the Anchor
   program (`onchain/programs/stockpredict`) using `anchor-spl`, with a vault
   token account owned by a `["vault"]` PDA.
2. Withdrawals become a program CPI signed by the PDA (no operator key can move
   funds arbitrarily).
3. Optionally mint outcome tokens (YES/NO) as SPL tokens for a conditional-token
   model like Polymarket's CTF.

This is Phase 3.5+ in `docs/SOLANA-ROADMAP.md`.
