# Aeris — Payment Layer for AI Agents on Solana

> Autonomous agent commerce. USDC on Solana. x402 protocol.

Aeris is infrastructure that lets AI agents pay each other and pay for services autonomously using USDC on Solana. It implements the [x402 (HTTP 402 Payment Required)](https://x402.org) standard as the request/response layer, with Solana as the settlement rail.

Built for the [Solana Frontier Hackathon](https://colosseum.org) (April – May 2026).

---

## Monorepo Structure

```
aeris/
├── apps/
│   └── web/          # Next.js frontend — AgentMarket demo app
├── packages/
│   └── sdk/          # aeris-pay TypeScript SDK (npm install aeris-pay)
└── programs/
    └── aeris/        # Anchor (Rust) Solana program
```

## Quick Start

```bash
# Install dependencies
npm install

# Build the Anchor program
npm run anchor:build

# Run Anchor tests (devnet)
npm run anchor:test

# Start the web app
npm run dev
```

## Sponsor Integrations

- **Privy** — embedded wallets + session keys
- **Coinbase / MoonPay** — fiat onramp
- **Phantom** — wallet adapter
- **USDC (Circle)** — stablecoin settlement

## Architecture

```
Agent A  ──[x402 request]──►  Aeris SDK  ──[USDC transfer]──►  Agent B
                                   │
                            Solana Program
                          (policy enforcement)
```
