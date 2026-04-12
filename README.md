# Aeris — Payment Layer for AI Agents on Solana

> Autonomous agent commerce. USDC on Solana. x402 protocol.

Aeris is infrastructure that lets AI agents pay each other and pay for services autonomously using USDC on Solana. It implements the [x402 (HTTP 402 Payment Required)](https://x402.org) standard as the request/response layer, with Solana as the settlement rail.

Built for the [Solana Frontier Hackathon](https://colosseum.org) (April – May 2026).

---

## What's working right now

- **Anchor program** deployed on Solana devnet — spend policy enforcement + SPL token transfers
- **Real USDC transfers** on devnet through the program (end-to-end tested)
- **aeris-pay SDK** — `AerisClient.pay()`, `SessionKey`, `PolicyEnforcer`
- **@aeris/x402 middleware** — `requirePayment()` for Express, `X402Client.fetch()` for agents
- **AgentMarket UI** — live at `localhost:3000/market` with real devnet transaction feed

---

## Repo Structure

```
aeris/
├── apps/
│   └── web/               # Next.js 14 + Tailwind — AgentMarket demo app
├── packages/
│   ├── sdk/               # aeris-pay TypeScript SDK
│   └── x402/              # HTTP 402 payment middleware
├── programs/
│   └── aeris/             # Anchor (Rust) Solana program
│       ├── programs/aeris/src/lib.rs   ← on-chain logic
│       └── tests/aeris.ts              ← integration tests
└── scripts/               # devnet setup + test scripts
    ├── setup-wallets.ts
    ├── fund-usdc.ts
    └── test-transfer.ts
```

---

## Prerequisites

Install these in order.

### 1. Rust
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env
rustc --version   # 1.94.x or later
```

### 2. Solana CLI (v2.1.0)
```bash
sh -c "$(curl -sSfL https://release.anza.xyz/v2.1.0/install)"
export PATH="/Users/$USER/.local/share/solana/install/active_release/bin:$PATH"
solana --version  # solana-cli 2.1.0
```

> Add the export to `~/.zshrc` or `~/.bash_profile` so it persists.

### 3. Anchor CLI (v1.0.0)
```bash
cargo install --git https://github.com/coral-xyz/anchor avm --locked
avm install latest
avm use latest
anchor --version  # anchor-cli 1.0.0
```

### 4. Node.js 20+
```bash
node --version  # v20.x or later
```

---

## Local Setup

```bash
git clone https://github.com/Amartya2001-droid/aeris.git
cd aeris
npm install
```

### One-time: generate a Solana keypair
```bash
solana-keygen new --outfile ~/.config/solana/id.json
solana config set --url devnet
solana airdrop 2  # or use https://faucet.solana.com
```

---

## Running the Web App

```bash
cd apps/web
npm install
npm run dev
```

Open [http://localhost:3000/market](http://localhost:3000/market) — AgentMarket with live devnet payment feed.

---

## Running the Anchor Tests

Requires two terminals.

**Terminal 1:**
```bash
solana-test-validator --reset
```

**Terminal 2:**
```bash
cd programs/aeris
npm install
anchor test --skip-local-validator
```

Expected:
```
  aeris
    ✔ initializes a spend policy
    ✔ executes a valid USDC payment
    ✔ rejects payment exceeding per-payment limit

  3 passing (3s)
```

> Note: Anchor 1.0.0 uses `surfpool` by default but the binary isn't published yet. Use `solana-test-validator` + `--skip-local-validator` instead.

---

## Running a Devnet Transfer

```bash
cd scripts
npm install

# Generate test wallets + create USDC ATAs
npx ts-node setup-wallets.ts

# Fund payer with devnet USDC at https://faucet.circle.com
# then run the end-to-end transfer:
npx ts-node test-transfer.ts
```

Expected output:
```
=== Before ===
Payer USDC:     20 USDC
Recipient USDC: 0 USDC

✓ Payment confirmed!
  Signature: 3sgJKXh8...
  Explorer:  https://explorer.solana.com/tx/...?cluster=devnet

=== After ===
Payer USDC:     19 USDC
Recipient USDC: 1 USDC
```

---

## On-chain Program

**Program ID (devnet):** `7zLsMUtip7bUXqztXn2MV71tZQP3D62bFz1XHvenKJJu`

| Instruction | What it does |
|---|---|
| `initialize_policy` | Creates a PDA storing per-agent spend limits (max per payment, rolling window) |
| `pay` | Enforces limits on-chain, executes SPL token transfer, emits `PaymentEvent` |

---

## SDK Usage

```typescript
import { AerisClient, SessionKey, SpendPolicy, PolicyEnforcer } from "aeris-pay";
import { PublicKey } from "@solana/web3.js";

const client = new AerisClient({ cluster: "devnet" });
const session = SessionKey.generate("my-agent");

const receipt = await client.pay(session, {
  endpoint: "https://api.example.com/scrape",
  amount: 1_000_000,  // $1.00 USDC
  recipient: new PublicKey("..."),
  description: "web-scrape",
});

console.log(receipt.signature);
```

## x402 Middleware Usage

```typescript
import { requirePayment } from "@aeris/x402";
import { PublicKey } from "@solana/web3.js";

// Server — gate an endpoint
app.get("/api/scrape", requirePayment({
  amount: 1_000_000,       // $1.00 USDC
  recipient: myWallet,
  description: "Web scrape service",
}), scrapeHandler);

// Client (agent) — auto-pay on 402
import { X402Client } from "@aeris/x402";
const x402 = new X402Client(aerisClient, sessionKey);
const response = await x402.fetch("https://api.example.com/api/scrape");
```

---

## Architecture

```
Agent A  ──[x402 request]──►  Aeris SDK  ──[USDC transfer]──►  Agent B
                                   │
                            Solana Program
                       (spend policy enforcement)
```

---

## Tech Stack

| Layer | Tech |
|---|---|
| Solana program | Anchor 1.0.0 (Rust) |
| SDK | TypeScript (`aeris-pay`) |
| x402 middleware | TypeScript (`@aeris/x402`) |
| Frontend | Next.js 14 + Tailwind |
| Auth / wallets | Privy (coming Week 2) |
| Stablecoin | USDC (SPL token) |
| Onramp | Coinbase / MoonPay (coming Week 4) |

---

## Sponsor Integrations

- **Privy** — embedded wallets + session keys for agents
- **Coinbase / MoonPay** — fiat onramp
- **Phantom** — wallet adapter
- **USDC (Circle)** — stablecoin settlement on Solana
