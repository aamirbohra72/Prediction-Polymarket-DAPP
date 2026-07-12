//! StockPredict Anchor program — Phase 2 skeleton
//!
//! Deploy (requires [Anchor](https://www.anchor-lang.com/docs/installation)):
//!   cd onchain && anchor build && anchor deploy --provider.cluster devnet
//!
//! See docs/SOLANA-ROADMAP.md for full integration plan.

use anchor_lang::prelude::*;

declare_id!("StockPr111111111111111111111111111111111");

#[program]
pub mod stockpredict {
    use super::*;

    /// Create an on-chain market PDA linked to off-chain market id (bytes32).
    pub fn initialize_market(
        ctx: Context<InitializeMarket>,
        market_key: [u8; 32],
        strike_cents: u64,
        resolve_ts: i64,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        market.authority = ctx.accounts.authority.key();
        market.market_key = market_key;
        market.strike_cents = strike_cents;
        market.resolve_ts = resolve_ts;
        market.status = MarketStatus::Open as u8;
        market.bump = ctx.bumps.market;
        Ok(())
    }

    /// Oracle/admin settles market — Phase 4.
    pub fn settle_market(ctx: Context<SettleMarket>, winning_outcome: u8) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(market.status == MarketStatus::Open as u8, ErrorCode::MarketClosed);
        market.status = MarketStatus::Resolved as u8;
        market.winning_outcome = winning_outcome;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(market_key: [u8; 32])]
pub struct InitializeMarket<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Market::INIT_SPACE,
        seeds = [b"market", market_key.as_ref()],
        bump
    )]
    pub market: Account<'info, Market>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    pub authority: Signer<'info>,
    #[account(mut, has_one = authority @ ErrorCode::Unauthorized)]
    pub market: Account<'info, Market>,
}

#[account]
#[derive(InitSpace)]
pub struct Market {
    pub authority: Pubkey,
    pub market_key: [u8; 32],
    pub strike_cents: u64,
    pub resolve_ts: i64,
    pub status: u8,
    pub winning_outcome: u8,
    pub bump: u8,
}

#[repr(u8)]
pub enum MarketStatus {
    Open = 0,
    Resolved = 1,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Unauthorized")]
    Unauthorized,
    #[msg("Market is not open")]
    MarketClosed,
}
