use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu");

#[program]
pub mod aeris {
    use super::*;

    /// Initialize a spend policy account for an agent.
    /// Called once per agent wallet on first use.
    pub fn initialize_policy(
        ctx: Context<InitializePolicy>,
        max_per_payment: u64,
        max_per_window: u64,
        window_seconds: i64,
    ) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        policy.agent = ctx.accounts.agent.key();
        policy.max_per_payment = max_per_payment;
        policy.max_per_window = max_per_window;
        policy.window_seconds = window_seconds;
        policy.window_start = Clock::get()?.unix_timestamp;
        policy.window_total = 0;
        policy.bump = ctx.bumps.policy;
        Ok(())
    }

    /// Execute a payment from one agent to a service/agent.
    /// Enforces the caller's spend policy on-chain.
    pub fn pay(ctx: Context<Pay>, amount: u64, description: String) -> Result<()> {
        let policy = &mut ctx.accounts.policy;
        let clock = Clock::get()?;

        // Reset window if expired
        if clock.unix_timestamp - policy.window_start > policy.window_seconds {
            policy.window_start = clock.unix_timestamp;
            policy.window_total = 0;
        }

        // Enforce per-payment limit
        require!(
            amount <= policy.max_per_payment,
            AerisError::ExceedsPerPaymentLimit
        );

        // Enforce per-window limit
        require!(
            policy.window_total.checked_add(amount).unwrap() <= policy.max_per_window,
            AerisError::ExceedsWindowLimit
        );

        // Execute the SPL token transfer
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.key(),
            Transfer {
                from: ctx.accounts.sender_token.to_account_info(),
                to: ctx.accounts.recipient_token.to_account_info(),
                authority: ctx.accounts.agent.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;

        // Update window total
        policy.window_total = policy.window_total.checked_add(amount).unwrap();

        emit!(PaymentEvent {
            sender: ctx.accounts.agent.key(),
            recipient: ctx.accounts.recipient_token.key(),
            amount,
            description,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

// ────────────────────────────────────────────────────────────────────────────
// Accounts
// ────────────────────────────────────────────────────────────────────────────

#[derive(Accounts)]
pub struct InitializePolicy<'info> {
    #[account(
        init,
        payer = agent,
        space = 8 + SpendPolicy::INIT_SPACE,
        seeds = [b"policy", agent.key().as_ref()],
        bump
    )]
    pub policy: Account<'info, SpendPolicy>,

    #[account(mut)]
    pub agent: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Pay<'info> {
    #[account(
        mut,
        seeds = [b"policy", agent.key().as_ref()],
        bump = policy.bump,
        has_one = agent,
    )]
    pub policy: Account<'info, SpendPolicy>,

    pub agent: Signer<'info>,

    #[account(mut, token::authority = agent)]
    pub sender_token: Account<'info, TokenAccount>,

    #[account(mut)]
    pub recipient_token: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

// ────────────────────────────────────────────────────────────────────────────
// State
// ────────────────────────────────────────────────────────────────────────────

#[account]
#[derive(InitSpace)]
pub struct SpendPolicy {
    /// The agent wallet this policy belongs to
    pub agent: Pubkey,
    /// Max single payment (USDC micro-units, 6 decimals)
    pub max_per_payment: u64,
    /// Max total spend per rolling window
    pub max_per_window: u64,
    /// Window length in seconds
    pub window_seconds: i64,
    /// Unix timestamp of when current window started
    pub window_start: i64,
    /// Total spent in the current window
    pub window_total: u64,
    /// PDA bump
    pub bump: u8,
}

// ────────────────────────────────────────────────────────────────────────────
// Events
// ────────────────────────────────────────────────────────────────────────────

#[event]
pub struct PaymentEvent {
    pub sender: Pubkey,
    pub recipient: Pubkey,
    pub amount: u64,
    pub description: String,
    pub timestamp: i64,
}

// ────────────────────────────────────────────────────────────────────────────
// Errors
// ────────────────────────────────────────────────────────────────────────────

#[error_code]
pub enum AerisError {
    #[msg("Payment amount exceeds the per-payment limit")]
    ExceedsPerPaymentLimit,
    #[msg("Payment would exceed the rolling window spend limit")]
    ExceedsWindowLimit,
}
