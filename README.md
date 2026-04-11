# Aeris — Payment Layer for AI Agents on Solana

> Autonomous agent commerce. USDC on Solana. x402 protocol.

Aeris is infrastructure that lets AI agents pay each other and pay for services autonomously using USDC on Solana. It implements the [x402 (HTTP 402 Payment Required)](https://x402.org) standard as the request/response layer, with Solana as the settlement rail.

Built for the [Solana Frontier Hackathon](https://colosseum.org) (April – May 2026).

---

## Repo Structure

```
aeris/
├── apps/
│   └── web/               # Next.js 14 + Tailwind — AgentMarket demo app
├── packages/
│   └── sdk/               # aeris-pay TypeScript SDK
└── programs/
    └── aeris/             # Anchor (Rust) Solana program
        ├── programs/aeris/src/lib.rs   ← on-chain logic
        └── tests/aeris.ts              ← integration tests
```

---

## Prerequisites

Install these in order before anything else.

### 1. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustc --version   # should print rustc 1.94.x or later
```

### 2. Solana CLI (v2.1.0)
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
export PATH="/Users/$USER/.local/share/solana/install/active_release/bin:$PATH"
solana --version  # should print solana-cli 2.1.0
```

> Add the export line to your `~/.zshrc` or `~/.bash_profile` so it persists.

### 3. Anchor CLI (v1.0.0)
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest
anchor --version  # should print anchor-cli 1.0.0
```

### 4. Node.js
Use Node 20+. Check with `node --version`. Install via [nvm](https://github.com/nvm-sh/nvm) if needed.

---

## Local Setup

```bash
git clone https://github.com/Amartya2001-droid/aeris.git
cd aeris
npm install
```

### Generate a local Solana keypair (one-time)
```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url devnet
```

---

## Running the Anchor Tests

The tests run against a local validator. You need two terminals.

**Terminal 1 — start the local validator:**
```bash
solana-test-validator --reset
```

**Terminal 2 — run the tests:**
```bash
cd programs/aeris
npm install
anchor test --skip-local-validator
```

Expected output:
```
  aeris
    ✔ initializes a spend policy
    ✔ executes a valid USDC payment
    ✔ rejects payment exceeding per-payment limit

  3 passing (3s)
```

---

## Running the Web App

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## On-chain Program

**Program ID (devnet):** `7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu`

Two instructions:

| Instruction | What it does |
|---|---|
| `initialize_policy` | Creates a PDA that stores per-agent spend limits |
| `pay` | Enforces limits on-chain, executes SPL token transfer, emits `PaymentEvent` |

---

## Architecture

```
Agent A  ──[x402 request]──►  Aeris SDK  ──[USDC transfer]──►  Agent B
                                   │
                            Solana Program
                          (policy enforcement on-chain)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Solana program | Anchor 1.0.0 (Rust) |
| Backend / SDK | Node.js + TypeScript |
| Frontend | Next.js 14 + Tailwind |
| Auth / wallets | Privy (embedded wallets + session keys) |
| Stablecoin | USDC (SPL token) |
| Onramp | Coinbase / MoonPay |

---

## Sponsor Integrations

- **Privy** — embedded wallets + session keys for agents
- **Coinbase / MoonPay** — fiat onramp
- **Phantom** — wallet adapter
- **USDC (Circle)** — stablecoin settlement on Solana
