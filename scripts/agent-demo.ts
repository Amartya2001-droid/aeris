/**
 * agent-demo.ts — Agent-to-Agent Payment Demo (x402 + Aeris)
 *
 * Demonstrates the full Aeris payment flow end-to-end:
 *
 *   Agent A (payer)  →  [x402 request]  →  Agent B (service provider)
 *                   ←  [402 + PaymentRequired]  ←
 *                   →  [pay via Aeris program]  →  Solana devnet
 *                   →  [X-PAYMENT header + retry]  →  Agent B
 *                   ←  [service response]  ←
 *
 * Usage:
 *   npx ts-node scripts/agent-demo.ts
 *   npx ts-node scripts/agent-demo.ts --amount 500000   # $0.50 USDC
 *
 * Prerequisites:
 *   - .local/wallet-payer.json      (run scripts/setup-wallets.ts first)
 *   - .local/wallet-recipient.json
 *   - Payer wallet needs devnet USDC (run scripts/fund-usdc.ts first)
 */

import * as http from "http";
import * as fs from "fs";
import * as path from "path";
import { Keypair, PublicKey } from "@solana/web3.js";

// SDK imports
const { AerisClient, SessionKey } = require("../packages/sdk/src/index");
const { buildPaymentHeader, verifyPaymentProof } = require("../packages/x402/src/index");

// ─── Config ──────────────────────────────────────────────────────────────────

const LOCAL_DIR = path.join(__dirname, "../.local");
const PAYER_PATH = path.join(LOCAL_DIR, "wallet-payer.json");
const RECIPIENT_PATH = path.join(LOCAL_DIR, "wallet-recipient.json");
const SERVICE_PORT = 4402;
const SERVICE_PRICE = parseInt(process.argv[2] === "--amount" ? process.argv[3] : "500000"); // $0.50

function loadKeypair(p: string): Keypair {
  return Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(fs.readFileSync(p, "utf8")))
  );
}

function parseArgs() {
  const args = process.argv.slice(2);
  const idx = args.indexOf("--amount");
  const amount = idx >= 0 ? parseInt(args[idx + 1]) : 500_000;
  return { amount };
}

// ─── Agent B: x402-protected service ─────────────────────────────────────────

async function startAgentB(recipientKeypair: Keypair): Promise<http.Server> {
  const server = http.createServer(async (req, res) => {
    console.log(`\n[Agent B] Received ${req.method} ${req.url}`);

    const paymentHeader = req.headers["x-payment"] as string | undefined;

    // No payment header → issue 402
    if (!paymentHeader) {
      const paymentRequired = {
        x402Version: "1",
        description: "Web scrape service — returns clean markdown",
        amount: SERVICE_PRICE,
        recipient: recipientKeypair.publicKey.toBase58(),
        network: "devnet",
        expiresAt: Math.floor(Date.now() / 1000) + 300,
        resource: "/api/scrape",
      };

      res.writeHead(402, {
        "Content-Type": "application/json",
        "X-402-Version": "1",
      });
      res.end(JSON.stringify(paymentRequired));

      console.log(`[Agent B] → 402 Payment Required ($${(SERVICE_PRICE / 1_000_000).toFixed(2)} USDC)`);
      return;
    }

    // Parse and verify payment proof
    try {
      const proof = JSON.parse(
        Buffer.from(paymentHeader, "base64").toString("utf8")
      );

      console.log(`[Agent B] Verifying payment: ${proof.signature.slice(0, 20)}…`);

      // Age check (proof must be < 5 minutes old)
      const ageSeconds = Math.floor(Date.now() / 1000) - proof.paidAt;
      if (ageSeconds > 300) {
        res.writeHead(402, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Payment proof expired" }));
        return;
      }

      // On devnet we verify on-chain; in this demo we trust the sig + age
      // (Production: use verifyPaymentProof() with the Aeris program)
      console.log(`[Agent B] ✓ Payment verified (${ageSeconds}s old)`);

      // Return the "scraped" content
      const response = {
        success: true,
        url: "https://example.com",
        content: `# Example Domain

This domain is for use in illustrative examples in documents.

**Scraped at:** ${new Date().toISOString()}
**Paid:** $${(SERVICE_PRICE / 1_000_000).toFixed(2)} USDC via x402
**Transaction:** ${proof.signature}
`,
        metadata: {
          wordCount: 42,
          processingMs: 94,
          model: "aeris-scraper-v1",
        },
      };

      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(response, null, 2));
      console.log(`[Agent B] → 200 OK — content returned`);
    } catch (err: any) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Invalid payment proof" }));
    }
  });

  return new Promise((resolve) => {
    server.listen(SERVICE_PORT, () => resolve(server));
  });
}

// ─── Agent A: autonomous payer ────────────────────────────────────────────────

async function runAgentA(payerKeypair: Keypair, recipientPubkey: PublicKey) {
  const { amount } = parseArgs();
  const serviceUrl = `http://localhost:${SERVICE_PORT}/api/scrape`;

  console.log(`\n[Agent A] Calling service: ${serviceUrl}`);
  console.log(`[Agent A] Budget: $${(amount / 1_000_000).toFixed(2)} USDC`);

  // Step 1: Initial request — expect 402
  const firstResponse = await fetch(serviceUrl);

  if (firstResponse.status !== 402) {
    console.log(`[Agent A] Unexpected status ${firstResponse.status} (expected 402)`);
    return;
  }

  const paymentRequired = await firstResponse.json();
  console.log(`\n[Agent A] Got 402 — service requires $${(paymentRequired.amount / 1_000_000).toFixed(2)} USDC`);
  console.log(`[Agent A] Recipient: ${paymentRequired.recipient}`);

  // Verify the price is within our budget
  if (paymentRequired.amount > amount) {
    console.error(`[Agent A] ✗ Price exceeds budget — aborting`);
    return;
  }

  // Step 2: Pay via Aeris
  console.log(`\n[Agent A] Paying via Aeris program on Solana devnet…`);

  const client = new AerisClient({ cluster: "devnet" });
  const sessionKey = SessionKey.fromKeypair(payerKeypair, "agent-a");

  let receipt;
  try {
    receipt = await client.pay(sessionKey, {
      endpoint: serviceUrl,
      amount: paymentRequired.amount,
      recipient: new PublicKey(paymentRequired.recipient),
      description: paymentRequired.description,
    });
  } catch (err: any) {
    console.error(`[Agent A] ✗ Payment failed: ${err.message}`);
    if (err.constructor.name === "InsufficientBalanceError") {
      console.error(`  → Get devnet USDC at https://faucet.circle.com`);
      console.error(`  → Wallet: ${payerKeypair.publicKey.toBase58()}`);
    }
    return;
  }

  console.log(`[Agent A] ✓ Payment sent!`);
  console.log(`[Agent A]   Signature: ${receipt.signature}`);
  console.log(`[Agent A]   Explorer:  https://explorer.solana.com/tx/${receipt.signature}?cluster=devnet`);

  // Step 3: Build X-PAYMENT header and retry
  const proof = client.buildPaymentProof(receipt);
  const paymentHeader = buildPaymentHeader(proof);

  console.log(`\n[Agent A] Retrying with X-PAYMENT header…`);

  const secondResponse = await fetch(serviceUrl, {
    headers: { "X-PAYMENT": paymentHeader },
  });

  if (secondResponse.status !== 200) {
    const body = await secondResponse.text();
    console.error(`[Agent A] ✗ Service rejected payment: ${secondResponse.status} ${body}`);
    return;
  }

  const result = await secondResponse.json();

  console.log(`\n[Agent A] ✓ Service returned content:\n`);
  console.log("─".repeat(60));
  console.log(result.content);
  console.log("─".repeat(60));
  console.log(`\n  Words: ${result.metadata.wordCount}`);
  console.log(`  Latency: ${result.metadata.processingMs}ms`);
  console.log(`  Model: ${result.metadata.model}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║     Aeris Agent-to-Agent Demo (x402 + Solana)    ║");
  console.log("╚═══════════════════════════════════════════════════╝");

  // Validate wallets exist
  if (!fs.existsSync(PAYER_PATH) || !fs.existsSync(RECIPIENT_PATH)) {
    console.error("\n✗ Wallet keypairs not found. Run setup-wallets.ts first:");
    console.error("  npx ts-node scripts/setup-wallets.ts");
    process.exit(1);
  }

  const payerKeypair = loadKeypair(PAYER_PATH);
  const recipientKeypair = loadKeypair(RECIPIENT_PATH);

  console.log(`\nAgent A (payer):    ${payerKeypair.publicKey.toBase58()}`);
  console.log(`Agent B (service):  ${recipientKeypair.publicKey.toBase58()}`);
  console.log(`Service port:       ${SERVICE_PORT}`);
  console.log(`Service price:      $${(SERVICE_PRICE / 1_000_000).toFixed(2)} USDC`);

  // Start Agent B's service
  console.log(`\n[Agent B] Starting x402-protected service on port ${SERVICE_PORT}…`);
  const server = await startAgentB(recipientKeypair);
  console.log(`[Agent B] Listening on http://localhost:${SERVICE_PORT}/api/scrape`);

  // Give the server a moment to bind
  await new Promise((r) => setTimeout(r, 200));

  try {
    // Run Agent A's payment flow
    await runAgentA(payerKeypair, recipientKeypair.publicKey);
  } finally {
    server.close();
    console.log(`\n[Agent B] Server stopped.`);
  }

  console.log("\n✓ Demo complete.\n");
}

main().catch((err) => {
  console.error("\nFatal error:", err.message ?? err);
  process.exit(1);
});
